---
title: "Computer #2: File descriptors"
description: Small integers that stand for terminals, files, pipes and sockets, and how the shell rewires them for > and |
slug: computer-2-file-descriptors
tags:
  - notes
  - computer
createdAt: 2026-11-19
layout: ../../layouts/BlogPost.astro
---

Part two of a series on learning the computer instead of the language. [Part 1](/posts/computer-1-process) split a process into two halves: its memory, and its record in the kernel. This part opens one drawer of that record, the open files. The references are CS:APP chapter 10 and OSTEP chapter 39.

## A number, not a file

When a process opens something, the kernel hands back a number. The `open(2)` man page defines it: "a small, nonnegative integer that is an index to an entry in the process's table of open file descriptors". OSTEP: "A file descriptor is just an integer, private per process".

That table is in the kernel, in the same structure that holds the cwd from part 1. In XNU's `bsd/sys/filedesc.h`, `struct filedesc` has `fd_ofiles`, the "file structures for open files", right next to `fd_cdir`.

Three numbers are taken before your program starts. "Each process by default has three open file descriptors":

| fd | Name | Usually |
|---|---|---|
| 0 | stdin | keyboard input |
| 1 | stdout | normal output |
| 2 | stderr | errors |

Node has the same numbers. `process.stdout.fd` "is fixed at 1".

## Everything is a file

"Everything is a file" is a slogan, not a quote from a spec. OSTEP's version is that "virtually everything that you can think of is named through the file system". What it means in practice: a terminal, a regular file, `/dev/null`, a pipe and a network socket are all reached through an fd, and all respond to `read` and `write`. `ls` doesn't know or care which one fd 1 is.

Look at your shell's table:

```sh
lsof -a -p $fish_pid -d 0,1,2
```

For my fish, all three point at `/dev/ttys000`, the terminal device for that tab. Same process, run from a different place, gives a different picture. The zsh that Claude Code starts for each command has fd 0 on `/dev/null` and fds 1 and 2 on a regular file that captures output. Run `tty` there and it prints `not a tty`, because `tty` checks fd 0 and finds no terminal.

macOS also lets a process look at its own table as files. Per `fd(4)`, "The files /dev/fd/0 through /dev/fd/# refer to file descriptors which can be accessed through the file system":

```sh
ls -l /dev/fd/
```

## fds survive fork and exec

From part 1: `fork` copies the kernel record and `execve` keeps it. That includes fds. "The child inherits copies of the parent's set of open file descriptors", and "By default, file descriptors remain open across an execve()."

That's the whole reason `ls` prints in your terminal. fish's fd 1 is the terminal. fish forks, and the child's fd 1 is the terminal. The child execs `ls`, and `ls`'s fd 1 is still the terminal. `ls` just writes to 1.

## `>`: change fd 1 in the gap

Part 1 left a question: why are `fork` and `exec` two calls? OSTEP's answer: "it lets the shell run code after the call to fork() but before the call to exec()".

Here is what fish does for `ls > out.txt`:

```c
pid_t pid = fork();
if (pid == 0) {                       // child, still running fish's code
    int fd = open("out.txt", O_WRONLY | O_CREAT | O_TRUNC, 0644);
    dup2(fd, 1);                      // fd 1 now points at out.txt
    close(fd);
    execvp("ls", argv);               // ls inherits the new fd 1
}
waitpid(pid, NULL, 0);
```

`dup2(fd, 1)` makes fd 1 refer "to the same open file description as" `fd`. After it, writing to 1 writes to `out.txt`. Then `exec` runs `ls`, which writes to fd 1 as always and never learns that it changed. OSTEP describes the same trick with `close(1)` followed by `open`, which works because a new fd always gets "the lowest-numbered file descriptor not currently open". It also notes that `dup2()` "is useful when writing a UNIX shell".

`2>&1` is the same move: `dup2(1, 2)`, make fd 2 point where fd 1 points. Order matters, because each step copies whatever the fd points to at that moment.

## `|`: two processes, one pipe

A pipe is "a unidirectional data channel" in the kernel, with two fds: `pipefd[0]` "refers to the read end" and `pipefd[1]` "refers to the write end". For `ls | wc -l` the shell does:

```c
int p[2];
pipe(p);

if (fork() == 0) {          // child 1: ls
    dup2(p[1], 1);          // stdout → write end
    close(p[0]); close(p[1]);
    execlp("ls", "ls", NULL);
}
if (fork() == 0) {          // child 2: wc
    dup2(p[0], 0);          // stdin ← read end
    close(p[0]); close(p[1]);
    execlp("wc", "wc", "-l", NULL);
}
close(p[0]); close(p[1]);   // the shell keeps neither end
wait(NULL); wait(NULL);
```

Neither `ls` nor `wc` knows about the pipe. `ls` writes to 1, `wc` reads from 0. The shell rewired those numbers in the gap between fork and exec. OSTEP sums up: "the output of one process is connected to an in-kernel pipe… input of another… connected to that same pipe".

The `close` calls matter. `wc` only sees end-of-file when every write end is closed. If the shell kept `p[1]` open, `wc` would wait forever.

## How this shows up in Node

- `console.log` writes to fd 1, `console.error` to fd 2. `node app.js > log.txt` redirects one and not the other for the same reason as above.
- `child_process.spawn` is fork and exec underneath. Its `stdio` option (`'pipe'`, `'inherit'`, `'ignore'`) decides what fds 0, 1 and 2 of the child point at: a new pipe, your own fds, or `/dev/null`.
- `process.stdout.isTTY` is how tools like Vite or Jest decide whether to print colors and progress bars. When you pipe their output, fd 1 is a pipe, not a terminal, so they print plain text.
- A socket from `net.createServer` is also an fd, waited on by the event loop. More in the [libuv post](/posts/libuv).

## Summary

- An fd is an index into a per-process table in the kernel. 0, 1 and 2 are stdin, stdout and stderr.
- Terminals, files, `/dev/null`, pipes and sockets all sit behind fds.
- fds are inherited across `fork` and kept across `exec`.
- `>` is `open` plus `dup2` between fork and exec. `|` is `pipe` plus two forks plus `dup2`. That gap is why fork and exec are separate.

## Exercises

1. Run `ls -l /dev/fd/`, then `ls -l /dev/fd/ | cat`. What changed for fd 1, and why?
2. Run `ls /doesnotexist > out.txt`. Why does the error still appear on screen? Then try `ls /doesnotexist > out.txt 2>&1` and `ls /doesnotexist 2>&1 > out.txt`. Explain the difference with `dup2`.
3. Run `tty`, then `tty < /dev/null`. What is `tty` actually checking?
4. In Node, print `process.stdout.isTTY` normally and through `| cat`.
5. Remove the shell's `close(p[1])` from the pipe code in your head. Which process hangs, and why?

## Sources

- CS:APP ch. 10, System-Level I/O
- OSTEP ch. 5, [Interlude: Process API](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf), and ch. 39, [Interlude: Files and Directories](https://pages.cs.wisc.edu/~remzi/OSTEP/file-intro.pdf)
- [open(2)](https://man7.org/linux/man-pages/man2/open.2.html), [dup(2)](https://man7.org/linux/man-pages/man2/dup.2.html), [pipe(2)](https://man7.org/linux/man-pages/man2/pipe.2.html), [fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html), [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html), [stdin(3)](https://man7.org/linux/man-pages/man3/stdin.3.html), Linux man pages
- XNU [`bsd/sys/filedesc.h`](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/filedesc.h) and [`fd(4)`](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/man/man4/fd.4)
- [tty(1)](https://man.freebsd.org/cgi/man.cgi?query=tty&sektion=1), FreeBSD
- [process](https://nodejs.org/api/process.html), Node.js docs
