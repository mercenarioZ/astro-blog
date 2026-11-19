---
title: "Computer #4: CPU and caches"
description: Why the same loop can be several times slower just by visiting memory in a different order
slug: computer-4-cpu-cache
tags:
  - notes
  - computer
createdAt: 2026-11-19
layout: ../../layouts/BlogPost.astro
---

Part four of a series on learning the computer instead of the language. [Part 3](/posts/computer-3-virtual-memory) ended with the TLB, a small cache for address translations. This part is about the caches for the data itself, and about how the CPU runs your instructions. The reference is CS:APP chapters 5 and 6, through the CMU 15-213 lecture slides that go with the book.

## A puzzle: same work, different order

Both loops add up every element of the same 4096×4096 array:

```js
const N = 4096;
const a = new Int32Array(N * N).fill(1);   // one flat block of memory

let s = 0, t = performance.now();
for (let i = 0; i < N; i++)
  for (let j = 0; j < N; j++) s += a[i * N + j];   // row by row
console.log("rows   ", Math.round(performance.now() - t), "ms");

s = 0; t = performance.now();
for (let j = 0; j < N; j++)
  for (let i = 0; i < N; i++) s += a[i * N + j];   // column by column
console.log("columns", Math.round(performance.now() - t), "ms");
```

Same number of additions, same result. Save it as `rows.mjs` and run `node rows.mjs`. The column loop is several times slower. The CPU didn't do more work. It waited longer for memory.

## Memory is slow, so there are layers

Peter Norvig keeps a table of rough timings "for various operations on a typical PC". The numbers are old, but the ratios still hold:

| Operation | Time |
|---|---|
| Fetch from L1 cache | 0.5 ns |
| Execute a typical instruction | 1 ns |
| Branch misprediction | 5 ns |
| Fetch from L2 cache | 7 ns |
| Mutex lock/unlock | 25 ns |
| Fetch from main memory | 100 ns |

Main memory is about 200 times slower than L1. A CPU core that had to go to RAM on every load would spend nearly all its time waiting.

So computers stack storage in layers: "Smaller, faster, and costlier (per byte) storage devices" at the top, "Larger, slower, and cheaper" ones below. Each layer is a cache for the next: "A smaller, faster storage device that acts as a staging area for a subset of the data in a larger, slower device."

```
registers
L1 cache      per core, smallest, fastest
L2 cache      shared by a cluster of cores
RAM           ~100 ns
SSD
```

## Locality: why caches work

Caches only help if programs reuse what's already in them. They do, because of locality. Programs "tend to use data and instructions with addresses near or equal to those they have used recently":

- **Temporal locality**: "Recently referenced items are likely to be referenced again in the near future". A loop counter, a hot function.
- **Spatial locality**: "Items with nearby addresses tend to be referenced close together in time". The next element of an array.

The cache moves memory in fixed blocks called cache lines. On a miss, the cache loads the whole line around the address you asked for. The next few elements then arrive for free. That is spatial locality being paid off.

## Back to the puzzle

The array is laid out row after row ("C arrays allocated in row-major order", and a flat `Int32Array` with `i * N + j` is the same). The row loop walks memory in order, a "stride-1 reference pattern". One miss loads a line, and the next elements in that line are hits.

The column loop jumps `N` elements, 16 KB, on every step. Each access lands on a different line. By the time the loop comes back to use the rest of a line, it has been evicted. CMU's slide on it says it "accesses distant elements: no spatial locality!"

CMU's advice for cache-friendly code:

- "Stride-1 reference patterns are good (spatial locality)"
- "Repeated references to variables are good (temporal locality)"
- "Minimize the misses in the inner loops"

CS:APP also has a "memory mountain", a 3D plot of read throughput as you change the stride and the size of the data. Small data and stride 1 sit on the peak. Big data and large strides fall off the cliffs, one cliff per cache level.

## Your Mac's caches

Apple exposes the layout through `sysctl`. Its docs say `hw.nperflevels` is "The number of types of general purpose processor cores in the SoC", and that "Lower values of N indicate higher-performance core types":

```sh
sysctl hw.nperflevels hw.perflevel0.name hw.perflevel1.name
sysctl hw.perflevel0.l1dcachesize hw.perflevel0.l2cachesize hw.perflevel0.cpusperl2
sysctl hw.cachelinesize
```

On M-series chips, `perflevel0` is the Performance cores and `perflevel1` the Efficiency cores. A recent benchmark paper lists 128 KB L1 data cache per P-core and 64 KB per E-core on M1 to M4, and 16 MB of L2 per P-cluster on M2 to M4. Your `sysctl` output is the real answer for your machine.

`hw.cachelinesize` reports 128 bytes on Apple Silicon, and Go's runtime uses 128 for these chips. Researchers measuring the M1 have argued the real line is 64 bytes, so treat it as "macOS reports 128", not settled fact.

Which core your code runs on also matters. Apple: "the system is more likely to run background tasks on lower performance cores to maximize battery life." E-cores have smaller caches.

## Inside the core: more than one thing at a time

CS:APP chapter 5 is about what the CPU does with instructions once data has arrived.

**Pipelining.** Each instruction goes through stages, and different instructions are in different stages at the same moment. CMU's slide: a pipelined unit can "complete 3 multiplications in 7 cycles, even though each requires 3 cycles".

**Superscalar.** "A superscalar processor can issue and execute multiple instructions in one cycle", as long as they don't depend on each other.

That condition is the catch. This loop is one long chain, each `+` waiting for the one before:

```js
let sum = 0;
for (let i = 0; i < n; i++) sum += a[i];
```

CS:APP's fix is to break the chain with separate accumulators, "Two independent 'streams' of operations":

```js
let s0 = 0, s1 = 0;
for (let i = 0; i < n; i += 2) { s0 += a[i]; s1 += a[i + 1]; }
const sum = s0 + s1;
```

In C this can be close to twice as fast. In JavaScript, the JIT and the bounds checks make it harder to predict. Measure before you rewrite anything.

**Branch prediction.** To keep the pipeline full, the CPU guesses which way an `if` will go and runs ahead. A wrong guess throws that work away. Norvig's table puts it at about 5 ns, ten L1 hits. Predictable branches, like a loop that runs many times, are almost free. Random ones are not.

## What this means for JavaScript

You don't control memory layout in JS the way you do in C, but you aren't powerless:

- **Typed arrays are flat.** An `ArrayBuffer` is "a generic raw binary data buffer", and a typed array is "an array-like view" of it. Walking one in order is stride-1, like the puzzle.
- **Arrays of objects are arrays of pointers.** In V8, "JavaScript values… are represented as objects and allocated on the V8 heap". An array of `{x, y}` objects holds references, and each object can be somewhere else. Visiting them can mean a cache miss per object. Storing `xs` and `ys` in two typed arrays (struct of arrays instead of array of structs) keeps them in order. That's the idea behind data-oriented design, used in game engines and in libraries that handle large datasets.
- **Keep arrays packed.** V8 tracks an "elements kind" per array, and "Operations on holey arrays require additional checks and expensive lookups on the prototype chain." Don't create holes with `new Array(n)` or `delete arr[i]` in hot code.

Most React code never hits these limits, because the DOM and the network cost more. They matter when you process a big list, draw on a canvas, or parse data in a worker.

## Summary

- RAM is about 100 times slower than L1, so the CPU sits behind layers of caches.
- Caches load whole lines and bet on temporal and spatial locality.
- Visiting memory in order (stride 1) is fast. Jumping around is slow, even with the same amount of work.
- A core runs many independent instructions at once and guesses branches. Long dependency chains and unpredictable branches waste that.
- In JS: prefer typed arrays and packed arrays for large numeric data, and know that an array of objects is an array of pointers.

## Exercises

1. Run the puzzle with `N` set to 64, 512 and 4096. When does the gap between rows and columns appear? Compare `N * N * 4` bytes with your L1 and L2 sizes from `sysctl`.
2. Rewrite the puzzle in C with a 2D array (`int a[N][N]`). Compile with `cc -O1` and compare the gap with Node's.
3. Store 1,000,000 points as an array of `{x, y}` objects, then as two `Float64Array`s. Time a loop that sums all `x`. Which is faster, and why?
4. Sort an array of random numbers, then time a loop that counts the numbers above the median, before and after sorting. Explain the result with branch prediction.
5. Run the `sysctl` commands above. How many P-cores share one L2 cache on your Mac?

## Sources

- CS:APP ch. 5, Optimizing Program Performance, and ch. 6, The Memory Hierarchy
- CMU 15-213 slides: [The Memory Hierarchy](https://www.cs.cmu.edu/~213/lectures/09-memory-hierarchy.pdf), [Cache Memories](https://www.cs.cmu.edu/~213/lectures/10-cache-memories.pdf), [Program Optimization](https://www.cs.cmu.edu/afs/cs/academic/class/15213-f15/www/lectures/10-optimization.pdf)
- [Teach Yourself Programming in Ten Years](https://norvig.com/21-days.html), Peter Norvig (timing table in "Answers")
- [Determining system capabilities](https://developer.apple.com/documentation/kernel/1387446-sysctlbyname/determining_system_capabilities), Apple
- [Tuning your code's performance for Apple silicon](https://developer.apple.com/documentation/apple-silicon/tuning-your-code-s-performance-for-apple-silicon), Apple
- [Apple vs. Oranges: Evaluating the Apple Silicon M-Series SoCs for HPC](https://arxiv.org/html/2502.05317v2), Hübner et al., Table 1
- [Go: cache line size for Apple M1](https://go.googlesource.com/sys/+/20c2bfdbfe249b02ea905477d7cff52673dadfa2)
- Wrenger et al., "Analyzing the memory ordering models of the Apple M1", *Journal of Systems Architecture*, 2024, [doi:10.1016/j.sysarc.2024.103102](https://doi.org/10.1016/j.sysarc.2024.103102)
- [Elements kinds in V8](https://v8.dev/blog/elements-kinds) and [Pointer compression in V8](https://v8.dev/blog/pointer-compression), V8 blog
- [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer) and [TypedArray](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray), MDN
