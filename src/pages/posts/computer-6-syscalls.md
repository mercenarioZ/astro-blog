---
title: "Computer #6: System calls and the kernel"
description: The one door between your program and the hardware, from fs.readFile down to svc #0x80
slug: computer-6-syscalls
tags:
  - notes
  - computer
createdAt: 2026-11-19
layout: ../../layouts/BlogPost.astro
---

Last part of a series on learning the computer instead of the language. Every earlier part ended at the same place. `fork`, `execve` and `chdir` in [part 1](/posts/computer-1-process), `open`, `dup2` and `pipe` in [part 2](/posts/computer-2-file-descriptors), page faults in [part 3](/posts/computer-3-virtual-memory), locks that sleep in [part 5](/posts/computer-5-concurrency). All of them cross from your program into the kernel. This part is about that crossing. The reference is CS:APP chapter 8, with OSTEP chapter 6.

## The problem: running code you don't trust, fast

The OS wants your program to run at full speed, so it runs it directly on the CPU. OSTEP calls this limited direct execution: "just run the program directly on the CPU". But if the program could do anything the CPU can do, it could write to any disk block or turn off the timer and never give the CPU back. The OS would be "'just a library'".

The answer is in hardware. The CPU has two modes:

- **User mode**: "code that runs in user mode is restricted in what it can do". No direct I/O, no changing page tables, no disabling interrupts.
- **Kernel mode**: the OS can do anything.

Your program, Node, the browser, fish: all user mode. When one of them needs something only the kernel can do, it asks. That request is a system call.

## A system call, at the bottom

Here is a complete macOS arm64 program with no C library, nothing but two system calls:

```asm
.global _main
.align 4
_main:
    mov x0, #1          // arg 1: fd 1, stdout
    adr x1, msg         // arg 2: pointer to the bytes
    mov x2, #14         // arg 3: length
    mov x16, #4         // syscall number 4: write
    svc #0x80           // trap into the kernel
    mov x0, #0          // exit status 0
    mov x16, #1         // syscall number 1: exit
    svc #0x80
msg: .ascii "hello, kernel\n"
```

`cc -o hello hello.s && ./hello` prints `hello, kernel`.

Three things are going on:

1. **Arguments go in registers**, `x0` to `x2`, the same registers a normal function call uses.
2. **The service is named by number**, in `x16`. OSTEP: "user code cannot specify an exact address to jump to, but rather must request a particular service via number". The numbers come from XNU's `bsd/kern/syscalls.master`: `1` is `exit`, `4` is `write`. XNU's own syscall stubs in `libsyscall/custom/SYS.h` load the number with `mov x16, #(num)` too. Go's old Darwin runtime used the same `SVC $0x80`.
3. **`svc` is the trap.** It "simultaneously jumps into the kernel and raises the privilege level to kernel mode". When the kernel is done, a return-from-trap instruction "returns into the calling user program while simultaneously reducing the privilege level".

Where does `svc` jump to? Not somewhere the program picks. "The kernel does so by setting up a trap table at boot time." Your program can only enter the kernel at the doors the kernel chose.

Other systems use the same idea with different details. Linux on arm64 uses `svc #0` with the number in `x8`. Linux on x86-64 uses the `syscall` instruction with the number in `eax`, and its table is different too: `write` is 1 there, not 4.

### Some XNU syscall numbers

| # | Call | Seen in |
|---|---|---|
| 1 | `exit` | every program, at the end |
| 2 | `fork` | part 1 |
| 3 | `read` | part 2 |
| 4 | `write` | part 2, and above |
| 5 | `open` | part 2 |
| 12 | `chdir` | part 1, why `cd` is a builtin |
| 20 | `getpid` | part 1 |
| 59 | `execve` | part 1 |

## Why you never write `svc` yourself

In C you call `write(1, buf, n)`, and it looks like a normal function. OSTEP: "it is a procedure call, but hidden inside that procedure call is the famous trap instruction". On macOS that procedure lives in `libsystem_kernel.dylib`, part of `libSystem`.

On macOS this is more than a convenience. Apple does not promise that syscall numbers stay the same. Its Technical Q&A QA1118: "Apple does not support statically linked binaries on Mac OS X", because that "assumes binary compatibility at the kernel system call interface, and we do not make any guarantees on that front." The stable interface is `libSystem`, not the trap.

Go learned this the hard way. Go used to make raw syscalls on macOS like the program above. Go 1.11 moved the runtime to `libSystem.dylib`, and in Go 1.12 "libSystem is now used when making syscalls on Darwin, ensuring forward-compatibility with future versions of macOS and iOS." Linux is the opposite case: its syscall numbers are a stable ABI, so Go still makes raw syscalls there.

## Syscalls are one kind of exception

CS:APP widens the picture. "An exception is a transfer of control to the OS kernel in response to some event." There are four classes:

| Class | Cause | Intended? | Returns to | Example |
|---|---|---|---|---|
| Interrupt | A device outside the CPU | No | the next instruction | timer, network card, keyboard |
| Trap | An instruction, on purpose | Yes | the next instruction | **system calls**, breakpoints |
| Fault | An instruction, by accident | No, maybe recoverable | the same instruction, again | page fault |
| Abort | A hardware error | No, unrecoverable | nowhere | memory parity error |

You've met all of them in this series:

- The **page fault** from [part 3](/posts/computer-3-virtual-memory) is a fault. The kernel loads the page and runs the same instruction again. If it can't fix it, CS:APP says the kernel "Sends SIGSEGV signal to user process".
- The **timer interrupt** is how the OS takes the CPU back. "A timer device can be programmed to raise an interrupt every so many milliseconds", and the kernel can then do a context switch: "save a few register values for the currently-executing process … and restore a few for the soon-to-be-executing process". That is how the two threads in [part 5](/posts/computer-5-concurrency) got interleaved.

One more thing to unlearn: the kernel is not a separate program sitting somewhere. CS:APP: "the kernel is not a separate process, but rather runs as part of some existing process". When your process traps, the CPU runs kernel code on behalf of your process.

### Signals go the other way

Exceptions go from a program to the kernel. Signals go from the kernel to a program. `SIGSEGV` ("Invalid memory reference") after a bad access, `SIGINT` ("Interrupt from keyboard") when you press Ctrl-C in a terminal, `SIGKILL` from `kill -9`. The `kill` command is itself a thin wrapper around the `kill` system call.

## The cost of crossing

A syscall saves registers, switches mode, runs kernel code and switches back. OSTEP measured about 4 µs per syscall on 1996 hardware and notes modern systems get "sub-microsecond results". That is still far more than a function call, which is a few nanoseconds.

This is why I/O libraries buffer. `console.log` in a loop, `printf` and Node streams all collect bytes in user space and hand the kernel bigger chunks, so they pay the crossing fewer times.

Some calls skip the kernel entirely. XNU maps a read-only "commpage" into every process. `gettimeofday` in libSystem reads the time from there through `__commpage_gettimeofday`, with no trap. That is why reading the clock is cheap.

## From `fs.readFile` to the kernel

Now the whole stack, starting from code you write every day:

```js
import { readFile } from "node:fs/promises";
const text = await readFile("package.json", "utf8");
```

1. Your JS runs on the main thread, in user mode, inside V8.
2. Node hands the work to libuv. "The promise APIs use the underlying Node.js threadpool to perform file system operations off the event loop thread."
3. libuv's docs explain why a thread pool: "there are no platform-specific file I/O primitives libuv could rely on", so it chooses to "run blocking file I/O operations in a thread pool".
4. A pool thread calls `open` and `read` in libSystem. Each one runs `svc` and traps into XNU, which finds the file through the vnode layer and copies bytes into your process's memory.
5. The thread finishes, and libuv wakes the event loop, which on macOS waits in `kqueue`, also a system call.
6. Your promise resolves.

Network I/O takes a shorter path. libuv uses "kqueue on OSX and other BSDs", and "network I/O is always performed in a single thread", the event loop thread itself. I covered the loop side in the [libuv post](/posts/libuv).

## Watching syscalls

On Linux, `strace` "intercepts and records the system calls made by a process". It is the best tool for learning this material.

On macOS the equivalent is `dtruss`, built on DTrace. System Integrity Protection limits it: Apple's SIP guide says "DTrace cannot be used to inspect system processes, whether from the Instruments application or the dtrace(1) command-line tool." With SIP on, expect `dtruss` to refuse. The easiest way to watch syscalls from a Mac is to run `strace` in a Linux VM or container, like the one [Docker runs on your Mac](/posts/docker-mac-vm):

```sh
docker run --rm -it alpine sh -c 'apk add -q strace && strace -f ls /'
```

You'll see `execve` first, `openat`, `getdents64` to read the directory, `write` to fd 1, and `exit_group` at the end.

## The whole series in one picture

```
  your code (JS, Go, C…)        user mode
  ───────────────────────
  runtime (V8, libuv, Go)
  ───────────────────────
  libSystem / libc              syscall wrappers
  ════════ svc / syscall ═══════════════════════
  kernel (XNU, Linux)           kernel mode
    processes, fds, page tables, scheduler
  ───────────────────────
  CPU, caches, RAM, disk
```

Mitchell Hashimoto's line that started this series was "Learn computer, language no matter." This is what he meant. Every language ends at the double line, and the kernel below it is the same for all of them.

## Summary

- The CPU has user mode and kernel mode. Programs run in user mode and enter the kernel only through traps.
- A syscall puts arguments in registers, a number in `x16` (macOS arm64), and runs `svc #0x80`.
- On macOS the stable interface is `libSystem`, not the syscall numbers. Go switched to it for that reason.
- Syscalls are traps. Page faults are faults. The timer is an interrupt. All are exceptions handled by the kernel.
- Crossing into the kernel costs far more than a function call, which is why I/O is buffered and why some calls use the commpage instead.

## Exercises

1. Assemble the `hello` program. Change the fd in `x0` to 2 and run `./hello 2>/dev/null`. What happened?
2. Change `x16` to a number that isn't in `syscalls.master`. What does the kernel do? Check `$status` after.
3. Run the `strace` command above, then run it on `node -e 'require("fs").readFileSync("/etc/hostname")'` in a `node` image. Find the `openat` and `read`.
4. Count how many `write` calls `strace` shows for `for i in $(seq 1000); do echo $i; done` versus `seq 1000`. Why the difference?
5. Look up the `ls` entry of every table in this series: which process ran it (part 1), which fd it wrote to (part 2), which page faults it took (part 3), and which syscalls it made (part 6).

## Sources

- CS:APP ch. 8, Exceptional Control Flow, and the CMU 15-213 slides [Exceptional Control Flow: Exceptions and Processes](https://www.cs.cmu.edu/afs/cs/academic/class/15213-f15/www/lectures/14-ecf-procs.pdf)
- OSTEP ch. 6, [Mechanism: Limited Direct Execution](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-mechanisms.pdf)
- XNU [`bsd/kern/syscalls.master`](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/kern/syscalls.master), [`libsyscall/custom/SYS.h`](https://github.com/apple-oss-distributions/xnu/blob/main/libsyscall/custom/SYS.h), [`__commpage_gettimeofday.c`](https://github.com/apple-oss-distributions/xnu/blob/main/libsyscall/wrappers/__commpage_gettimeofday.c)
- Go runtime [`sys_darwin_arm64.s`](https://go.googlesource.com/go/+/go1.9/src/runtime/sys_darwin_arm64.s) (Go 1.9)
- [syscall(2)](https://man7.org/linux/man-pages/man2/syscall.2.html), [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html), [strace(1)](https://man7.org/linux/man-pages/man1/strace.1.html), Linux man pages
- [QA1118: Statically linked binaries on Mac OS X](https://developer.apple.com/library/archive/qa/qa1118/_index.html), Apple
- [Go 1.11](https://go.dev/doc/go1.11) and [Go 1.12](https://go.dev/doc/go1.12) release notes
- [System Integrity Protection: Runtime Protections](https://developer.apple.com/library/archive/documentation/Security/Conceptual/System_Integrity_Protection_Guide/RuntimeProtections/RuntimeProtections.html), Apple
- [libuv design overview](https://docs.libuv.org/en/v1.x/design.html)
- [File system: Promises API](https://nodejs.org/api/fs.html), Node.js docs
