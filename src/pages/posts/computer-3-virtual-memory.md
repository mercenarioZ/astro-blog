---
title: "Computer #3: Virtual memory"
description: Every address your program sees is made up, and the OS and the CPU translate it on every access
slug: computer-3-virtual-memory
tags:
  - notes
  - computer
createdAt: 2026-11-19
layout: ../../layouts/BlogPost.astro
---

Part three of a series on learning the computer instead of the language. [Part 1](/posts/computer-1-process) said a process has two halves: its memory, and its record in the kernel. [Part 2](/posts/computer-2-file-descriptors) opened the kernel record. This part opens the memory. The reference is OSTEP chapters 13 to 23.

## A puzzle to start

Part 1 showed that `fork()` copies a process. Here is a program that forks, then changes a global variable in the child only:

```c
#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

int x = 1;

int main(void) {
    if (fork() == 0) {
        x = 2;
        printf("child:  &x = %p, x = %d\n", (void *)&x, x);
        return 0;
    }
    wait(NULL);
    printf("parent: &x = %p, x = %d\n", (void *)&x, x);
}
```

Compile it with `cc -o vm vm.c` and run it. Both lines print the **same address**, and different values: 2 in the child, 1 in the parent.

One address, two values. That can't be a location in RAM. It is a location in each process's own *view* of memory, and the two views map to different physical places.

## Every address you see is virtual

OSTEP calls this view the address space, "the running program's view of memory in the system". The OS gives "the illusion of a large, sparse, private address space to each running program". And the key line: "any address you can see as a programmer of a user-level program is a virtual address."

That covers `&x` in C, a pointer in Rust, and every object V8 allocates for your React app. None of them is a RAM address. The CPU translates each one on every load and store.

Why bother? Isolation. OSTEP's principle is that "each process should be running in its own isolated cocoon". A bug in one process can't write into another process's memory, because it has no address that reaches there. The man page for `fork(2)` says it directly: "The child process and the parent process run in separate memory spaces."

## Pages and page tables

Translating every byte one by one would need a huge table. So memory is cut into fixed-size blocks. OSTEP: "we divide it into fixed-sized units, each of which we call a page". The physical slots in RAM are page frames.

A virtual address splits into two parts:

```
virtual address = [ virtual page number | offset ]
                          │                 │
             page table   ▼                 │  (copied as is)
                  [ page frame number | offset ] = physical address
```

The page table is "a per-process data structure" that maps virtual page numbers to frames. The offset inside the page "stays the same (i.e., it is not translated)". Each process has its own page table, which is how two processes can both use `&x` and end up in different frames.

Each page table entry also carries bits:

| Bit | Meaning |
|---|---|
| Valid | Is this part of the address space in use at all? |
| Protection | "whether the page could be read from, written to, or executed from" |
| Present | "whether this page is in physical memory or on disk" |
| Dirty, accessed | Has it been written? Used recently? |

### Page size on your Mac

On Intel Macs a page is 4 KB. On Apple Silicon it is 16 KB. Apple's porting guide says "Virtual memory page sizes are different" and tells you to read `vm_page_size` instead of hardcoding it. Apple's developer support puts the numbers as "16 KiB on 64-bit ARM platforms" and 4 KiB elsewhere. Check yours:

```sh
pagesize
vm_stat | head -1    # vm_stat prints the page size in its header
```

Rosetta still gives translated Intel apps 4 KB pages, per Apple's WWDC20 session on porting to Apple Silicon.

## The TLB: making translation fast

If every memory access first had to read the page table from memory, every access would cost two. OSTEP estimates that would "slow down the process by a factor of two or more."

The fix is a cache inside the CPU for translations, the TLB: "simply a hardware cache of popular virtual-to-physical address translations". OSTEP goes as far as "TLBs in a real sense make virtual memory possible". A hit costs almost nothing. A miss means walking the page table: "When a miss occurs, the high cost of paging is incurred".

Bigger pages help here. With 16 KB pages, each TLB entry covers four times as much memory as with 4 KB pages. Caches come back in [part 4](/posts/computer-4-cpu-cache).

## What the valid bit explains

### Segmentation faults

Page 0, the page containing address 0, is left out of every address space on purpose. Its entry is marked invalid. OSTEP's aside "Why Null Pointer Accesses Cause Seg Faults" walks through it: you dereference `NULL`, the CPU finds an invalid entry and traps into the kernel, and the OS "likely terminates the process".

```c
int main(void) { int *p = 0; return *p; }
```

The kernel kills it with `SIGSEGV`, signal 11, "Invalid memory reference". Bash reports a death by signal N as exit status 128+N, so `echo $?` prints 139. On macOS the crash report says `EXC_BAD_ACCESS (SIGSEGV)`.

In JavaScript you never see this. V8 checks bounds and types before touching memory, so a bad access becomes `undefined` or a `TypeError`, not a trap.

### Copy-on-write makes fork cheap

Back to the puzzle. If `fork()` really copied every page of a big process, it would be slow. It doesn't. `fork(2)`: "fork() is implemented using copy-on-write pages".

OSTEP describes the trick. On fork, the OS maps the same physical pages into both processes "and mark[s] it read-only in both address spaces". Reads are shared. The first write traps into the kernel, which then "(lazily) allocate[s] a new page" for the writer and copies the data. In the puzzle, `x = 2` in the child is that first write. Only that one page gets copied.

This is also why fork + exec is not wasteful. exec throws the whole address space away, so almost nothing was ever copied.

### Memory you asked for but don't have yet

When a process asks for new memory, the OS doesn't fill it right away. OSTEP calls it demand zeroing: the page is mapped as invalid, and only on first touch does the OS find a frame, zero it, and map it in. "If the process never accesses the page, all such work is avoided".

So `malloc` of 4 GB returns quickly, and the process's resident memory barely moves until you write to it. Linux takes this furthest. Its `malloc(3)` page warns: "when malloc() returns non-NULL there is no guarantee that the memory really is available".

## When RAM runs out

The present bit lets a page live on disk. OSTEP: "swap space allows the system to pretend that memory is larger than it actually is." Touching a page that isn't in RAM is a page fault. The OS loads the page from disk, fixes the page table, and retries the instruction, all "transparently to the process."

It is transparent but not free. A bad choice of which page to evict can make a program "run 10,000 or 100,000 times slower."

macOS adds a step before swap: it compresses memory first. Activity Monitor's Memory tab shows both. "Compressed" is "memory that has been compressed to make more RAM available", and "Swap Used" is "space being used on your startup disk". The Memory Pressure graph turns red when "Your computer needs more RAM."

## Seeing it on macOS

```sh
vm_stat                     # system-wide page counts, including
                            # "Pages stored in compressor" and "Pages copy-on-write"
vmmap (pgrep -n node) | less   # every region in one process's address space
```

`vmmap` will "Display the virtual memory regions allocated in a process": the code, the stacks, the malloc zones and every mapped library. It also separates resident from dirty memory, "Dirty and swapped are memory which has been written to by the process."

## Where your JavaScript lives

A Node process is one address space. V8's heap is a region inside it. The V8 team describes arranging "V8's heap in a contiguous 4-GB region of address space" for pointer compression. `process.memoryUsage()` shows the layers:

```js
console.log(process.memoryUsage());
// rss:       all of the process's memory that is in RAM
// heapTotal, heapUsed: V8's heap
// external, arrayBuffers: memory V8 points to but doesn't manage
```

Node's docs define `rss` as the space "in the main memory device… including all C++ and JavaScript objects and code". That is the page-level view. `heapUsed` is V8's own view, one level up.

In the browser, Chromium puts "pages from different websites… in different processes, each running in a sandbox". Each of those processes has its own page table. That is what stops a malicious site's JavaScript from reading your bank's tab, even if it finds a bug in V8.

## Summary

- Every address a program sees is virtual. Each process has its own address space.
- Memory is split into pages. A per-process page table maps them to physical frames. Apple Silicon uses 16 KB pages.
- The TLB caches translations so that translation is almost free.
- An invalid entry gives you a segfault. A read-only shared entry gives you copy-on-write. An entry that isn't there yet gives you lazy allocation. A page on disk gives you swap.
- V8's heap is one region in the address space of a Node process or a browser renderer process.

## Exercises

1. Run the fork puzzle. Run it again. Does the address change between runs? Look up ASLR in OSTEP chapter 23.
2. Write a C program that `malloc`s 4 GB, sleeps, then writes to the first 1 GB and sleeps again. Watch its memory in Activity Monitor at each step.
3. Run `pagesize` on your Mac. Then run `arch -x86_64 /bin/sh -c pagesize`. Why might the second number be different?
4. Run `vmmap` on a Node process. Find the stacks for its threads and the region V8 uses for its heap.
5. Compare `rss` and `heapUsed` from `process.memoryUsage()` before and after allocating a 100 MB `ArrayBuffer`. Which one moves, and why?

## Sources

- OSTEP ch. 13, [The Abstraction: Address Spaces](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-intro.pdf)
- OSTEP ch. 18, [Paging: Introduction](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-paging.pdf)
- OSTEP ch. 19, [Paging: Faster Translations (TLBs)](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-tlbs.pdf)
- OSTEP ch. 21, [Beyond Physical Memory: Mechanisms](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-beyondphys.pdf)
- OSTEP ch. 23, [Complete Virtual Memory Systems](https://pages.cs.wisc.edu/~remzi/OSTEP/vm-complete.pdf)
- [fork(2)](https://man7.org/linux/man-pages/man2/fork.2.html), [malloc(3)](https://man7.org/linux/man-pages/man3/malloc.3.html), [signal(7)](https://man7.org/linux/man-pages/man7/signal.7.html), Linux man pages
- [Bash: Exit Status](https://www.gnu.org/software/bash/manual/html_node/Exit-Status.html)
- [Addressing architectural differences in your macOS code](https://developer.apple.com/documentation/apple-silicon/addressing-architectural-differences-in-your-macos-code), Apple
- [Port your Mac app to Apple silicon](https://developer.apple.com/videos/play/wwdc2020/10214/), WWDC20
- [Page size on 64-bit ARM](https://developer.apple.com/forums/thread/47532), Apple Developer Forums
- [SIGSEGV](https://developer.apple.com/documentation/xcode/sigsegv), Apple
- [vm_stat(1)](https://keith.github.io/xcode-man-pages/vm_stat.1.html), [vmmap(1)](https://keith.github.io/xcode-man-pages/vmmap.1.html), macOS man pages
- [View memory usage in Activity Monitor](https://support.apple.com/guide/activity-monitor/view-memory-usage-actmntr1004/mac), Apple
- [process.memoryUsage()](https://nodejs.org/api/process.html#processmemoryusage), Node.js docs
- [Pointer compression in V8](https://v8.dev/blog/pointer-compression), V8 blog
- [Site Isolation](https://www.chromium.org/Home/chromium-security/site-isolation/), Chromium
