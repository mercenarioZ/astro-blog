---
title: "Computer #5: Threads, locks and races"
description: Why counter++ gives the wrong answer on two threads, and why JavaScript mostly gets away with it
slug: computer-5-concurrency
tags:
  - notes
  - computer
createdAt: 2026-11-19
layout: ../../layouts/BlogPost.astro
---

Part five of a series on learning the computer instead of the language. Earlier parts covered [processes](/posts/computer-1-process), [file descriptors](/posts/computer-2-file-descriptors), [virtual memory](/posts/computer-3-virtual-memory) and [CPU caches](/posts/computer-4-cpu-cache). The reference for this one is OSTEP chapters 26 to 32.

A process has one address space. So far each one also had one line of execution. A thread is a second line of execution inside the same process. OSTEP puts it this way: a thread is "very much like a separate process, except for one difference: they share the same address space".

That one difference is the whole topic. Sharing memory is why threads are useful, and also why they break.

## What a thread owns and what it shares

| Per thread | Shared by all threads in the process |
|---|---|
| Registers, including the program counter | Code |
| Its own stack | Heap and global variables |
| | Open file descriptors, cwd, PID |

OSTEP: "Each thread has its own private set of registers", and "Instead of a single stack in the address space, there will be one per thread." Switching between two threads of the same process is cheaper than switching processes because "the address space remains the same (i.e., there is no need to switch which page table we are using)". That page table is the one from [part 3](/posts/computer-3-virtual-memory).

You can see threads on macOS. `ps -M` prints "the threads corresponding to each task", one line per thread:

```sh
ps -M -p (pgrep -n node)
```

Activity Monitor also shows the total number of processes and threads at the bottom of the window.

## Experiment: two threads, one counter

This is OSTEP's example from chapter 26. Two threads each add 1 to a shared counter ten million times:

```c
#include <stdio.h>
#include <pthread.h>

static volatile int counter = 0;

void *work(void *arg) {
    for (int i = 0; i < 10000000; i++)
        counter = counter + 1;
    return NULL;
}

int main(void) {
    pthread_t a, b;
    pthread_create(&a, NULL, work, NULL);
    pthread_create(&b, NULL, work, NULL);
    pthread_join(a, NULL);
    pthread_join(b, NULL);
    printf("counter = %d\n", counter);
}
```

The right answer is 20,000,000. In the book, one run printed `counter = 19345221` and the next printed `counter = 19221041`. In the authors' words: "Not only is each run wrong, but also yields a *different* result!" Build it with `cc -o count count.c` and run it a few times to see your own numbers.

## Why: one line of C is three instructions

`counter = counter + 1` looks atomic. The CPU sees three steps. OSTEP shows the x86 version:

```asm
mov 0x8049a1c, %eax   ; load counter into a register
add $0x1, %eax        ; add 1 in the register
mov %eax, 0x8049a1c   ; store it back
```

Each thread has its own registers, so this can happen:

| Thread A | Thread B | counter in memory |
|---|---|---|
| load 50 | | 50 |
| add → 51 | | 50 |
| | load 50 | 50 |
| | add → 51 | 50 |
| | store 51 | 51 |
| store 51 | | 51 |

Two increments ran and the counter went up by one. The book walks through the same trace from 50 and notes that a correct program "should have resulted in the variable counter equal to 52". It happens "even on a single processor", because the OS can switch threads between any two instructions.

Some vocabulary from the chapter:

- **Race condition** (or data race): "the results depend on the timing" of execution.
- **Critical section**: "a piece of code that accesses a shared resource, usually a variable or data structure". Here it is the three instructions.
- **Mutual exclusion**: "if one thread is executing within the critical section, the others will be prevented from doing so".
- **Atomic**: "'as a unit', which sometimes we take as 'all or none.'"

## Locks

A lock makes the critical section atomic. The POSIX name for a lock is a mutex:

```c
pthread_mutex_t lock = PTHREAD_MUTEX_INITIALIZER;

pthread_mutex_lock(&lock);
counter = counter + 1;
pthread_mutex_unlock(&lock);
```

With the lock, the answer is 20,000,000 every time. The cost is that only one thread at a time makes progress inside the critical section.

### How a lock is built

A lock can't be built from ordinary loads and stores, because checking "is it free?" and setting "now it's mine" is itself a race. The hardware has to help. OSTEP chapter 28 goes through the instructions CPUs provide:

- **Test-and-set** (atomic exchange): write a new value and return the old one, in one step.
- **Compare-and-swap**: "test whether the value at the address specified by ptr is equal to expected; if so, update".
- **Fetch-and-add**: add to a value and return the old one.

The simplest lock built on these is a spin lock. It "simply spins, using CPU cycles, until the lock becomes available". That wastes CPU, so real locks spin for a short while and then ask the kernel to put the thread to sleep. On Linux that kernel help is the futex. The book calls this a two-phase lock.

### Waiting for something to happen

A lock protects data. Sometimes a thread needs to wait for a condition instead, like "the queue is not empty". That is a condition variable, "an explicit queue that threads can put themselves on when some state of execution … is not as desired". `pthread_cond_wait(&cond, &lock)` releases the lock and puts the thread to sleep, atomically. The book's rule: always re-check the condition in a `while` loop, because a wakeup is only a hint.

### Deadlock

Two threads, two locks, taken in opposite order, and each waits forever for the other. OSTEP lists the four conditions that all have to hold:

1. **Mutual exclusion**: threads claim exclusive control of resources.
2. **Hold-and-wait**: threads hold resources while waiting for more.
3. **No preemption**: locks can't be taken away from their holder.
4. **Circular wait**: a cycle where each thread holds what the next one wants.

"If any of these four conditions are not met, deadlock cannot occur." The practical fix is to break the cycle: "provide a total ordering on lock acquisition", so every thread takes locks in the same order.

In a study of 105 real concurrency bugs in MySQL, Apache, Mozilla and OpenOffice cited by OSTEP, 74 were not deadlocks, and 97% of those were atomicity or order violations. The counter bug above is an atomicity violation.

## Where JavaScript fits

### One thread per agent

Your React code runs on one thread. MDN's execution model page: "An agent is a thread, which means the interpreter can only process one statement at a time." And: "whenever a function runs, it cannot be preempted and will run entirely before any other code runs." It contrasts this with C, where a thread "may be stopped at any point".

So `count++` in a click handler can't be interrupted halfway by another handler. The interleaving from the table above can't happen to plain JS objects inside one agent. MDN doesn't put it in those words, but it follows from the two quotes.

### Races at `await`

Run-to-completion holds per function body, not per async function. MDN: "The body of an async function can be thought of as being split by zero or more await expressions." At every `await`, other code can run. This has the same shape as the counter bug:

```js
async function addToCart(id) {
  const cart = await loadCart();   // read
  cart.items.push(id);             // modify
  await saveCart(cart);            // write
}

addToCart("a");
addToCart("b");   // both read the same old cart; one item is lost
```

No two instructions ran at the same time. The race is between two read-modify-write sequences that overlap across `await`. It's the kind of bug that shows up in React effects that fetch and then set state after the component has moved on.

### Workers are threads

Web Workers "run scripts in background threads", and in Node "Workers (threads) are useful for performing CPU-intensive JavaScript operations. They do not help much with I/O-intensive work", since I/O already happens off the main thread in libuv. Each worker gets its own agent, so the one-thread rule holds inside each one.

By default nothing is shared. Data passed between threads "is copied, not shared", which "does not involve any concurrency complications". The exception is `SharedArrayBuffer`, which creates "views on shared memory". Once memory is shared, the counter bug comes back:

```js
// race.mjs
import { Worker, isMainThread, workerData } from "node:worker_threads";

const N = 1_000_000;

if (isMainThread) {
  const shared = new Int32Array(new SharedArrayBuffer(8));
  const run = () =>
    new Promise((done) =>
      new Worker(new URL(import.meta.url), { workerData: shared }).on("exit", done),
    );
  await Promise.all([run(), run()]);
  console.log("plain  :", shared[0], "of", 2 * N);
  console.log("atomics:", shared[1], "of", 2 * N);
} else {
  const c = workerData;
  for (let i = 0; i < N; i++) c[0]++;                // load, add, store
  for (let i = 0; i < N; i++) Atomics.add(c, 1, 1);  // one atomic step
}
```

`c[0]++` is the same three steps as before, so the plain count comes out short. `Atomics.add` "adds a given value at a given position in the array, and returns the old value". That is OSTEP's fetch-and-add, exposed to JavaScript. MDN says it plainly: "To synchronize, atomic operations are needed."

In the browser, `SharedArrayBuffer` only works when the page is cross-origin isolated (the `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers). Check with `crossOriginIsolated` in the console.

Go has the same problem with goroutines and ships a tool for it. Its race detector defines the bug the same way: "A data race occurs when two goroutines access the same variable concurrently and at least one of the accesses is a write."

## Summary

- A thread is a line of execution with its own registers and stack. Threads in a process share memory.
- `x = x + 1` is load, add, store. Two threads can interleave those and lose updates.
- A lock makes a critical section atomic. It's built on hardware instructions like compare-and-swap, and sleeps in the kernel when it can't get the lock quickly.
- Deadlock needs four conditions. Taking locks in a fixed order breaks one of them.
- JavaScript runs one thread per agent and never preempts a function, so plain objects are safe. `await` still splits functions, and `SharedArrayBuffer` brings real data races back, fixed with `Atomics`.

## Exercises

1. Run the C counter several times. Then add the mutex and run it again. Time both with `time ./count`.
2. Run `race.mjs` a few times. Is the plain count the same every run? Why is it never above 2,000,000?
3. Fix `addToCart` so two calls can't lose an item. Is a lock the only way?
4. Start a Node script with a worker and count its threads with `ps -M`. Why are there more threads than workers? Hint: libuv's thread pool from the [libuv post](/posts/libuv).
5. Write two threads that deadlock with two mutexes. Then make them take the locks in the same order.

## Sources

- OSTEP ch. 26, [Concurrency: An Introduction](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-intro.pdf)
- OSTEP ch. 28, [Locks](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-locks.pdf)
- OSTEP ch. 30, [Condition Variables](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-cv.pdf)
- OSTEP ch. 32, [Common Concurrency Problems](https://pages.cs.wisc.edu/~remzi/OSTEP/threads-bugs.pdf)
- [ps(1)](https://keith.github.io/xcode-man-pages/ps.1.html), macOS man page
- [Activity Monitor: view process information](https://support.apple.com/guide/activity-monitor/view-basic-process-information-actmntr1001/mac), Apple
- [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model), MDN
- [async function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function), MDN
- [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), MDN
- [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), [Atomics.add](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/add), [crossOriginIsolated](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated), MDN
- [Worker threads](https://nodejs.org/api/worker_threads.html), Node.js docs
- [Data Race Detector](https://go.dev/doc/articles/race_detector), Go docs
