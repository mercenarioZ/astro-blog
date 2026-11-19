---
title: "Computer #1: How a program becomes a process"
description: fork, exec and wait, why cd has to be a shell builtin, and where your React app actually runs
slug: computer-1-process
tags:
  - notes
  - computer
createdAt: 2026-11-19
layout: ../../layouts/BlogPost.astro
---

Mitchell Hashimoto wrote: "Language is just a tool to talk to computer. All computer work same. Learn computer, language no matter." When someone asked what "computer" means, he said the hardware, its software interface and how it runs, plus the OS, the most important middleman.

This series is my attempt to learn that. Six parts: processes, file descriptors, virtual memory, CPU caches, concurrency, and system calls. Each one starts from something you can poke at on a Mac with fish, then goes to the theory. The main references are OSTEP (*Operating Systems: Three Easy Pieces*, [free online](https://pages.cs.wisc.edu/~remzi/OSTEP/)) and CS:APP (*Computer Systems: A Programmer's Perspective*). This part follows OSTEP chapters 4 to 6.

## Program vs process

A program is a file of machine code the OS knows how to load. Look at one:

```sh
file /bin/ls
xxd -l 4 /bin/ls
```

`file` says *Mach-O universal binary* with an `x86_64` and an `arm64e` slice, one for Intel Macs and one for Apple Silicon. The first four bytes are `cafe babe`. That is `FAT_MAGIC`, defined in XNU's `mach-o/fat.h` as `0xcafebabe` and "always written and read to/from disk in big-endian order". A single-architecture Mach-O file starts with a different magic number.

OSTEP puts the difference well: "The program itself is a lifeless thing". A process "is a running program". It has a PID, a parent, its own memory, and a record in the kernel.

```sh
echo $fish_pid
ps -o pid,ppid,comm
```

Every process has a parent (PPID), so processes form a tree. Follow the PPIDs up from your shell and you'll see how you got here. On my Mac the chain is `rex → login → -fish → claude → zsh`: the terminal app starts `login`, which starts fish as a login shell (the leading `-` marks it), which started Claude Code, which started a zsh to run a command. XNU's process struct stores it directly: `pid_t p_ppid; /* process's parent pid number */`.

## Three system calls

### `fork()`: one more worker

"fork() creates a new process by duplicating the calling process." After `fork`, two processes run the same code from the same point. The only difference is the return value: "the PID of the child process is returned in the parent, and 0 is returned in the child."

### `execve()`: same worker, new job

`execve` replaces the running program with a new one. Per its man page, "there is no new process", and in particular the PID stays the same. "On success, execve() does not return", because the code that called it is gone.

### `wait()`: the parent sleeps until the child is done

The parent calls `wait` to sleep until a child exits and to collect its exit code. In fish you read that code from `$status`.

If a parent never waits, the finished child stays in the process table. "A child that terminates, but has not been waited for becomes a 'zombie'." It holds no memory, only an entry with its exit code, waiting for someone to collect it.

### Four combinations

| fork? | exec? | Example | What happens |
|---|---|---|---|
| yes | yes | `ls` | The shell forks, the child execs `ls`, the shell waits |
| no | no | `cd` | A builtin. The shell does it itself |
| yes | no | `fish -c '…' &`, a worker | A copy of the same program does other work |
| no | yes | `exec ls` | fish becomes `ls`. When `ls` exits, nothing is left, so the tab closes |

Try the last one in a throwaway tab.

## A shell is just a program

fish is `/opt/homebrew/bin/fish`, listed in `/etc/shells`. It's not special. OSTEP describes every Unix shell as a loop: it reads a command, "calls fork()… calls some variant of exec()… then waits… by calling wait()… prints out a prompt again".

The terminal is a different program. Rex (or Ghostty, or iTerm) draws characters and sends keystrokes. fish reads commands and starts processes. You can run bash in Rex, or fish in Ghostty.

Why split fork and exec into two calls instead of one "run this program" call? OSTEP: "it lets the shell run code after the call to fork() but before the call to exec()". That gap is where redirection and pipes happen. That's [part 2](/posts/computer-2-file-descriptors).

## Why `cd` must be a builtin

Try to imagine `cd` as a normal program. The shell forks, the child execs `/usr/bin/cd`, which calls `chdir(path)`. The man page: `chdir` "changes the current working directory of the calling process". There is no PID argument. It changes the child's directory, the child exits, and the shell is exactly where it was.

So `cd` has to run inside the shell process. POSIX says so: "Since cd affects the current shell execution environment, it is always provided as a shell regular built-in."

macOS does ship a `/usr/bin/cd`. It's a tiny `sh` script from FreeBSD, shared with `alias`, `fg`, `wait` and others:

```sh
cat /usr/bin/cd
# builtin `echo ${0##*/} | tr \[:upper:] \[:lower:]` ${1+"$@"}
```

It starts a new `sh`, runs `builtin cd` in it, and exits. The directory change dies with that `sh`, so the script does nothing useful for your shell.

In fish, `cd` is a function: "fish also ships a wrapper function around the builtin cd that understands cd - as changing to the previous directory." Run `type cd` to read it. Tools like zoxide follow the same rule. The `z` binary can only print a path. A shell function then calls `cd` on it.

## The cwd lives in the kernel

The working directory isn't stored as a string in your shell. It's in the kernel's record of the process. In XNU, `bsd/sys/filedesc.h` has:

```c
struct vnode *fd_cdir;  /* (L) current directory */
```

A pointer to a vnode, the kernel's object for a file or directory, not a path. You can see it from outside:

```sh
lsof -a -p $fish_pid -d cwd
```

Because it's a pointer and not a name, renaming the directory doesn't move you out of it. `mkdir /tmp/a; cd /tmp/a; mv /tmp/a /tmp/b` from another tab, then `pwd -P` in the first one prints `/tmp/b`. Plain `pwd` may still print `/tmp/a`, because the shell keeps its own copy of the path as text.

## A process has two halves

Putting it together:

| | Memory (user space) | Record in the kernel |
|---|---|---|
| Holds | code, stack, heap, variables | PID, PPID, cwd, open files… |
| `fork` | copied | copied |
| `execve` | thrown away, new program loaded | kept |

`fork` copies both halves. `execve` keeps the kernel half: "By default, file descriptors remain open across an execve()", and "The current working directory is left unchanged by execve(2)." That is why `ls` lists the directory you were in, and prints to your terminal.

## Where does a React app run?

The CPU can't run JavaScript. It runs machine code. So the process is always some engine:

- `npm run dev`: the process is `node`. Find it with `ps -o pid,ppid,comm | grep node`. In Node, `process.pid` and `process.ppid` give the same numbers ps shows.
- In the browser: the process is a renderer, running V8. Chromium's process model puts documents from different sites in different processes, "each process is locked to documents from a single site", and new tabs often get their own. That's why one tab crashing usually doesn't take the others with it.

Two examples from my own setup:

- `rex run -- claude` starts claude directly in a new pane, with no shell around it. When claude exits, nothing is left in the pane, so it closes. That's the `exec ls` row from the table. Rex's `--keep-open`, or starting a shell first, keeps it.
- Claude Code's Bash tool starts a fresh `zsh` for every command. The PID changes every time, and the harness remembers the cwd between commands, because no shell survives to remember it.

## Summary

- A program is a file. A process is a running program with a PID, a parent, memory and a kernel record.
- `fork` copies a process, `execve` replaces its program but keeps the PID, `wait` collects the exit code.
- A shell is a loop of read, fork, exec, wait. The terminal is a separate program.
- `cd` has to be a builtin because `chdir` only changes the calling process.
- The cwd is a vnode pointer in the kernel, and it survives `execve`.

## Exercises

1. Run `echo $fish_pid` and `ps -o pid,ppid,comm`. Draw the tree from your terminal app down to `ps`.
2. Start `fish` inside fish, three times. What happens to `$fish_pid` and to the PPID column? Type `exit` three times.
3. Explain in two sentences, to someone who knows only React, why `cd` can't be a normal program.
4. Run `sleep 100 &` twice, then `ps -o pid,ppid,stat,comm`. Who is the parent of both? What does `jobs` show?
5. Does your browser use a process or a thread for each site? Check Activity Monitor or the browser's own task manager and explain what you see.

## Sources

- OSTEP ch. 4, [The Abstraction: The Process](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-intro.pdf)
- OSTEP ch. 5, [Interlude: Process API](https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf)
- [fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html), [execve(2)](https://man7.org/linux/man-pages/man2/execve.2.html), [wait(2)](https://man7.org/linux/man-pages/man2/wait.2.html), [chdir(2)](https://man7.org/linux/man-pages/man2/chdir.2.html), Linux man pages
- POSIX [cd](https://pubs.opengroup.org/onlinepubs/9799919799/utilities/cd.html)
- XNU [`bsd/sys/filedesc.h`](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/filedesc.h), [`bsd/sys/proc_internal.h`](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_internal.h), [`mach-o/fat.h`](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/fat.h)
- [`alias/generic.sh`](https://github.com/apple-oss-distributions/shell_cmds/blob/main/alias/generic.sh), Apple shell_cmds
- [cd](https://fishshell.com/docs/current/cmds/cd.html), fish docs
- [Process model and site isolation](https://chromium.googlesource.com/chromium/src/+/main/docs/process_model_and_site_isolation.md), Chromium
- [process](https://nodejs.org/api/process.html), Node.js docs
