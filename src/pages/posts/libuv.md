---
title: Learning libuv, the event loop under Node.js
description: Reading the C source under Node, and finding it friendlier than expected
slug: libuv
tags:
  - tech
# heroImage: libuv/hero-v2.svg
createdAt: 2026-08-18
layout: ../../layouts/BlogPost.astro
---

## Node already ships it

Before reading anything, try this:

```bash
node -p "process.versions.uv"
```

Mine says `1.51.0` on Node v22.19.0. That is libuv, and it is not something you installed. Node keeps the entire C library inside its own repository under `deps/uv` and builds it in.

I had been avoiding the source because I assumed a C event loop would be unreadable. It is not. It is one of the friendlier codebases I have opened, and most of my "I just memorized this" Node facts turned out to be sitting there in plain sight. This post is mostly me pointing at those bits.

The one-line summary first: operating systems do not agree on how to tell you I/O is ready. Linux has `epoll`, macOS and the BSDs have `kqueue`, SunOS has event ports, and Windows has IOCP, which is not even the same shape because it reports completions instead of readiness. libuv hides all four behind one API, then decides when your callbacks run.

## Handles are nouns, requests are verbs

Everything in libuv is a loop, a handle, or a request.

A handle is a long-lived event source: a TCP socket, a timer, a child process. A request is one short-lived operation: one write, one connect, one file read. Handles are nouns, requests are verbs. A `uv_tcp_t` is "the connection." A `uv_write_t` is "this write."

That is a lifetime rule, not just naming. Handles get closed with `uv_close()` and their memory can only be freed inside or after the close callback. Requests just finish, and the callback is what tells you they are done. Reuse a `uv_write_t` while its write is still queued and the docs say, in those words, undefined behavior.

In Node you never touch any of this, because Node opens and closes every handle for you. That is a big part of what its C++ layer does all day.

## The whole event loop is one while loop

Here is `uv_run()` from `src/unix/core.c`, with the metrics lines removed:

```c
while (r != 0 && loop->stop_flag == 0) {
  uv__run_pending(loop);
  uv__run_idle(loop);
  uv__run_prepare(loop);

  timeout = 0;
  if ((mode == UV_RUN_ONCE && can_sleep) || mode == UV_RUN_DEFAULT)
    timeout = uv__backend_timeout(loop);

  uv__io_poll(loop, timeout);

  uv__run_check(loop);
  uv__run_closing_handles(loop);

  uv__update_time(loop);
  uv__run_timers(loop);

  r = uv__loop_alive(loop);
}
```

That is it. That is the thing every Node event loop diagram is drawing. Every coloured box in those diagrams is one function call in that list, in that order, and `uv__io_poll()` is the only line that ever sleeps.

Right after the poll there is my favourite bit of the file:

```c
/* Process immediate callbacks (e.g. write_cb) a small fixed number of
 * times to avoid loop starvation.*/
for (r = 0; r < 8 && !uv__queue_empty(&loop->pending_queue); r++)
  uv__run_pending(loop);
```

Eight. If your callbacks keep queueing more callbacks, libuv does eight rounds and then walks away so that timers and close callbacks still get their turn. No explanation for why eight. Someone picked it, and a very large amount of the internet now runs on that number.

A few lines above the loop there is also a small ghost:

```c
/* Maintain backwards compatibility by processing timers before entering the
 * while loop for UV_RUN_DEFAULT. Otherwise timers only need to be executed
 * once, which should be done after polling in order to maintain proper
 * execution order of the conceptual event loop. */
```

Timers used to run before polling. Someone decided that was the wrong order, moved them after, and then left this extra pre-loop timer run behind so nothing broke. That change shipped in libuv 1.45.0, which is the libuv in Node 20.

## Why your program will not exit

The `while` condition calls `uv__loop_alive()`. Five lines:

```c
static int uv__loop_alive(const uv_loop_t* loop) {
  return uv__has_active_handles(loop) ||
         uv__has_active_reqs(loop) ||
         !uv__queue_empty(&loop->pending_queue) ||
         loop->closing_handles != NULL;
}
```

Every time a Node script refuses to exit, this function is the reason, and it is an honest one. An open socket. A `setInterval` nobody cleared. Something still closing. There is no mystery layer above it. Node stays alive because one of those four things is true.

## Four threads, and a very trusting parser

Network I/O is genuinely non-blocking: the socket goes into `epoll` or `kqueue` and the kernel reports readiness.

File I/O is not, because there is no file API that is reliably non-blocking everywhere. So libuv cheats. It runs the blocking call on worker threads, along with `getaddrinfo` and `getnameinfo`.

The famous default pool size of four is not a constant or a config value. It is this:

```c
static uv_thread_t default_threads[4];
```

An array. That is where the four comes from. And the code that lets you override it, in `src/threadpool.c`, is charmingly relaxed:

```c
nthreads = ARRAY_SIZE(default_threads);

buflen = ARRAY_SIZE(buf);
err = uv_os_getenv("UV_THREADPOOL_SIZE", buf, &buflen);
val = NULL;
if (err == 0)
  val = buf;

if (val != NULL)
  nthreads = atoi(val);
if (nthreads == 0)
  nthreads = 1;
if (nthreads > MAX_THREADPOOL_SIZE)
  nthreads = MAX_THREADPOOL_SIZE;
```

`atoi()` returns 0 when it cannot parse anything, and there is no error check. So `UV_THREADPOOL_SIZE=banana` quietly means one thread. I tried it, and it really does:

```
$ UV_THREADPOOL_SIZE=banana node pool.js
task 0 done at 75ms
task 1 done at 147ms
task 2 done at 220ms
task 3 done at 293ms
```

Perfectly serial. A typo in an env var silently drops you to a single worker thread, and nothing anywhere warns you.

Here is the script, four hashes that all go to the pool:

```js
const crypto = require("node:crypto");
const start = Date.now();

for (let i = 0; i < 4; i++) {
  crypto.pbkdf2("secret", "salt", 300000, 64, "sha512", () => {
    console.log(`task ${i} done at ${Date.now() - start}ms`);
  });
}
```

With the default four threads they finish together, around 90ms each. With one thread they queue up at 70, 140, 210, 280. Same JavaScript. The callbacks were just waiting for a thread.

The handoff back to the loop is short enough to read in one sitting:

```c
w->work(w);

uv_mutex_lock(&w->loop->wq_mutex);
w->work = NULL;  /* Signal uv_cancel() that the work req is done
                    executing. */
uv__queue_insert_tail(&w->loop->wq, &w->wq);
uv_async_send(&w->loop->wq_async);
uv_mutex_unlock(&w->loop->wq_mutex);
```

The worker does the blocking part, marks itself past the point of cancellation, drops the finished item on the loop's queue, and pokes the loop awake. Your callback runs later, back on the loop thread. That is why a Node callback never needs a mutex even though a real thread did the work.

The same pool is hiding inside DNS, which catches people out:

| Call | What it really does |
| --- | --- |
| `dns.lookup()` | A blocking `getaddrinfo(3)` on the thread pool |
| `dns.resolve()` | A real DNS query on the network, no thread pool |

Both look equally asynchronous in JavaScript. Only one of them can eat all four threads and stall every file read in your process.

## Reading the loop back in JavaScript

The Node event loop is that same `while` loop with JavaScript names bolted on:

| Node phase | libuv call | What schedules work there |
| --- | --- | --- |
| timers | `uv__run_timers()` | `setTimeout`, `setInterval` |
| pending callbacks | `uv__run_pending()` | I/O callbacks held over from last tick |
| idle, prepare | `uv__run_idle()`, `uv__run_prepare()` | internal only |
| poll | `uv__io_poll()` | most I/O callbacks |
| check | `uv__run_check()` | `setImmediate` |
| close callbacks | `uv__run_closing_handles()` | `socket.on("close", ...)` |

Which finally killed a piece of trivia I had been carrying around unexamined:

```js
const fs = require("node:fs");

fs.readFile(__filename, () => {
  setTimeout(() => console.log("timeout"), 0);
  setImmediate(() => console.log("immediate"));
});
```

`immediate` wins every single time, and it is not a special case. Scroll back up to `uv_run()`. Inside an I/O callback we are parked at `uv__io_poll()`. The next line is `uv__run_check()`, which is where `setImmediate` lives. `uv__run_timers()` is two lines further down. The answer is just reading order.

And one thing that is genuinely not in there: `process.nextTick()`. Go looking for it in that `while` loop and you will not find it, because Node drains that queue itself after whatever it was doing, regardless of which phase the loop is in.

## What I took from it

Reading libuv was much less scary than expected, and I got more out of an afternoon in `src/unix/core.c` than out of any number of event loop diagrams. The whole loop is a `while` block. The reason your script hangs is a five-line function. The famous four threads are an array of four.

If you want to poke around, `src/unix/core.c` and `src/threadpool.c` are the two files to open first, and a copy is already sitting in `deps/uv` inside the Node repo you have probably cloned before.

The lesson that stuck is the boring one. An event loop is not mainly about waiting efficiently. It is about scheduling honestly, and being clear about which promises the kernel is keeping and which ones the library is quietly keeping for it.

## Sources

- [libuv design overview](https://docs.libuv.org/en/v1.x/design.html)
- [libuv thread pool](https://docs.libuv.org/en/v1.x/threadpool.html)
- [libuv `src/unix/core.c`](https://github.com/libuv/libuv/blob/v1.x/src/unix/core.c)
- [libuv `src/threadpool.c`](https://github.com/libuv/libuv/blob/v1.x/src/threadpool.c)
- [The Node.js event loop](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick)
- [Node.js DNS implementation considerations](https://nodejs.org/api/dns.html#implementation-considerations)
