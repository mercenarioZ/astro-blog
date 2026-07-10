---
title: Why I still enjoy working close to the terminal with CLI and Vim
description: Notes on building a quieter workflow with command-line tools
slug: cli-vim
tags:
  - tech
heroImage: cli-vim/hero.svg
createdAt: 2026-06-15
layout: ../../layouts/BlogPost.astro
---

## The quiet surface of the terminal

I have been spending more time in the terminal lately, and I keep coming back to the same thought: the CLI feels quiet in a way most graphical tools do not. It gives me a small surface, a clear prompt, and a direct path from intention to action.

That does not mean it is always faster at first. A command-line workflow asks for patience. You need to remember commands, flags, paths, and sometimes weird behavior that only makes sense after you have broken something once. But once those pieces start to connect, the terminal becomes less like a tool you operate and more like a place where work happens.

## Vim starts as a language

Vim has the same feeling. The first experience is usually awkward. Moving without arrow keys, switching modes, deleting text with combinations of letters, and saving with `:w` can feel unnecessarily strange. But after a while, the language starts to make sense. `d` means delete. `w` means word. `ci"` means change inside quotes. It is not just shortcuts; it is a grammar for editing text.

## Modes come first

If I had to explain Vim to someone starting out, I would begin with the idea of modes. In insert mode, you type text like a normal editor. In normal mode, your keyboard becomes a control surface for moving and changing text. Press `i` to enter insert mode, press `Esc` to return to normal mode, and most of Vim starts from there.

## Basic movement

The basic movement keys are `h`, `j`, `k`, and `l`. They move left, down, up, and right. They feel strange for a while, but the point is not to be clever. The point is that your fingers stay near the home row, so movement becomes part of typing instead of a separate action.

Vim becomes more useful when you move by meaning instead of by single characters. `w` jumps to the next word. `b` jumps back one word. `e` moves to the end of a word. `0` goes to the start of a line, and `$` goes to the end. `gg` jumps to the top of a file, while `G` jumps to the bottom. These motions sound small, but they remove a lot of repetitive tapping.

## Editing with combinations

The editing commands combine with those motions. `dw` deletes a word. `d$` deletes from the cursor to the end of the line. `cw` changes a word and puts you into insert mode. `yy` copies a line, `dd` deletes a line, and `p` pastes after the cursor. This is where Vim starts to feel like a language: action plus movement.

Some examples I use often:

| Command | What it does |
| --- | --- |
| `ci"` | Change everything inside quotes |
| `ci)` | Change everything inside parentheses |
| `di{` | Delete everything inside braces |
| `yiw` | Copy the current word |
| `dd` | Delete the current line |
| `u` | Undo |
| `Ctrl+r` | Redo |

## Search, replace, save

Search is another basic skill worth learning early. Press `/`, type what you want to find, then press `Enter`. Use `n` to jump to the next match and `N` to jump to the previous one. If I need to replace text, I usually start with something like `:%s/old/new/g`, which means replace `old` with `new` across the whole file.

Saving and quitting are also part of the rhythm. `:w` saves. `:q` quits. `:wq` saves and quits. `:q!` quits without saving. These commands are famous because beginners get stuck on them, but after a while they become muscle memory.

## A small practice routine

A simple practice routine would look like this: open a markdown file, move around using only `hjkl`, jump between words with `w` and `b`, delete a few words with `dw`, undo with `u`, search with `/`, then save with `:w`. That is enough to start. You do not need a large config or a list of plugins to feel the core idea.

## Why it still feels good

The reason I like Vim is not because it makes me look technical. I like it because it keeps my hands and my attention in one place. I can jump around a file, change structure, search, replace, split windows, and move between buffers without constantly switching context. Small friction disappears.

The CLI and Vim also make tools feel composable. A file can be searched with `rg`, opened in Vim, transformed with a shell command, committed with Git, and pushed without leaving the same environment. Each tool does one focused job, and together they become a workflow that is easy to extend.

## Keeping the setup boring

There is still a cost. Configuration can become a hobby by accident. Plugins can pile up. Dotfiles can turn into a second project. I try to avoid that by keeping my setup boring. If a keybinding or plugin does not remove real friction, I probably do not need it.

For now, my goal is simple: get better at the basics. Move faster inside files. Understand shell commands more deeply. Learn the tools that are already available before adding more. The best part of CLI and Vim is not that they are minimal. It is that they reward attention.
