---
title: A tour of my terminal stack
description: The four layers I actually live in — Ghostty, tmux, Neovim, and Starship — and the small decisions that make them fit together
slug: terminal-stack
tags:
  - tech
heroImage: terminal-stack/hero-v2.webp
createdAt: 2026-09-20
layout: ../../layouts/BlogPost.astro
---

## Four layers, one screen

Most of my work happens in a single window, but the window is not one program. It is four programs stacked on top of each other, each replacing a default:

- **Ghostty** draws the text.
- **tmux** decides what is on screen.
- **Neovim** edits the files.
- **Starship** reports where I am and what state things are in.

Everything below lives in one repository at `~/code/dotfiles`, symlinked into `~/.config`. This post walks the stack from the outside in, and explains the choices that were not obvious the first time.

## Ghostty: the terminal

The terminal emulator is the layer I think about least, which is the point. My Ghostty config is twenty-three lines, and most of them are about legibility:

```ini
theme = Everforest Dark Hard
font-family = BlexMono Nerd Font
font-size = 14.5
font-thicken = true

cursor-color = fcee86
cursor-opacity = 0.8
cursor-style = block

window-padding-x = 8
window-padding-y = 8
window-padding-balance = true

macos-option-as-alt = left
```

Three of those lines carry real weight.

`font-thicken` matters more than it sounds. On macOS, thin monospace fonts at small sizes get smeared by subpixel rendering, and the extra weight keeps glyphs crisp at 14.5 rather than forcing me up a size.

`macos-option-as-alt` maps Option to Alt, which is what every terminal program expects. Without it, `Alt` keybindings in Neovim and readline simply never arrive.

Padding is set to `8` on both axes with `window-padding-balance = true`, so the block cursor never sits flush against the window edge. It also means the text block stays centered when the window is resized instead of drifting left.

I also set `background-opacity = 1` and left `background-blur-radius` commented out. Translucent terminals look good in screenshots and are harder to read all day, so the blur is available but off.

Ghostty uses a different file per platform — `config` for macOS and `linux.conf` for Linux — because the runtime settings genuinely differ. The macOS file needs `macos-option-as-alt`; the Linux file needs GTK and quick-terminal settings. The README documents linking the right one, because linking the wrong one fails quietly.

## tmux: the multiplexer

tmux is where the shape of my work lives. Panes and windows outlast SSH sessions, editor restarts, and accidental `Ctrl+C`.

The first change everyone makes:

```text
unbind C-b
set-option -g prefix C-t
set-option -g repeat-time 0
```

`Ctrl-t` replaces the default `Ctrl-b`. `Ctrl-b` is a stretch away from the home row, and moving the prefix frees the default binding for whatever else wants it. `repeat-time 0` disables the window during which the prefix stays "held" for repeated commands — I would rather press the prefix each time than have a keypress land in the wrong window because a previous command was still repeating.

Two clipboard decisions took longer to get right:

```text
set -g mouse on
set -g set-clipboard off
```

Mouse mode is on, so scrolling and pane selection work like a normal terminal. But `set-clipboard off` stops tmux from pushing scrollback into the system clipboard on every selection, which fights with the operating system's own copy behavior. Instead, copying is explicit: `y` in copy mode pipes through `pbcopy` on macOS and `wl-copy` on Wayland. Selections stay inside tmux until I ask for them.

The theme is Everforest, matched to Neovim and Ghostty so the three layers agree on color. Pane borders carry the most information:

```text
set -g pane-active-border-style fg=#83c092,bg=default
set -g pane-border-style fg=#475258,bg=default
set -g window-style fg=#859280,bg=default
set -g window-active-style fg=#a7c080,bg=default
```

The active pane gets a brighter border _and_ brighter text; inactive panes recede. In a four-pane layout that is worth more than any status bar decoration.

`history-limit` is raised to `64096`, and `escape-time` is dropped to `10` milliseconds so that `Esc` in Neovim does not feel sticky. `set-titles on` makes the terminal title follow the current pane's host, which matters when several sessions point at different machines.

Plugins are managed by TPM — `tmux-pain-control`, `tmux-cpu`, and `tmux-battery` — and installed per device rather than committed. The plugin directory is gitignored, and TPM only runs if its binary exists, so a fresh machine does not error on startup.

Platform differences are sourced at load time:

```text
if-shell 'test "$(uname -s)" = "Darwin"' \
  'source-file ~/.config/tmux/macos.conf' \
  'source-file ~/.config/tmux/linux.conf'
```

The macOS file adds `terminal-features ",xterm-ghostty:RGB"` for true color, binds `o` to open the pane's directory in Finder, and binds copy-mode `y` to `pbcopy`. The Linux file assumes Wayland and `wl-copy`. One config file, two behaviors, no `if` statements scattered through the body.

## Neovim: the editor

This is the layer with the most configuration and the least ceremony. I spent almost my spare time configurating this!

I use Neovim's built-in `vim.pack` instead of a plugin manager, I used to use LazyVim, it's a great starter package, btw. That means no bootstrap script, no lockfile regeneration step, and no separate tool to keep updated:

```lua
vim.pack.add({
  { src = gh("neanias/everforest-nvim") },
  { src = gh("nvim-mini/mini.icons") },
  { src = gh("folke/snacks.nvim") },
  { src = gh("mason-org/mason.nvim") },
  { src = gh("neovim/nvim-lspconfig") },
  { src = gh("saghen/blink.cmp"), version = vim.version.range("^1") },
  { src = gh("nvim-treesitter/nvim-treesitter"), version = "main" },
  -- ...
})
```

Two pins are deliberate. `blink.cmp` is held to `^1` because release tags ship a prebuilt fuzzy matcher, while `main` requires a Rust toolchain. `nvim-treesitter` tracks `main`, which means parsers must be built — so an autocmd watches for installs and updates and runs `TSUpdate` at the right moment:

```lua
vim.api.nvim_create_autocmd("PackChanged", {
  callback = function(event)
    local name, kind = event.data.spec.name, event.data.kind
    if name == "nvim-treesitter" and (kind == "install" or kind == "update") then
      vim.cmd("TSUpdate")
    end
  end,
})
```

Language servers are enabled with the native client, one name per line:

```lua
vim.lsp.enable({
  "astro", "clangd", "cssls", "gopls", "html", "lua_ls",
  "marksman", "tailwindcss", "vtsls", "vue_ls", "yamlls",
})
```

Mason handles installation; per-server settings live in `after/lsp/<server>.lua`, so a server's configuration sits in a file named after it. LSP keymaps are attached only when a server actually attaches to a buffer, which keeps them out of buffers that have no language server:

```lua
map("n", "gD", vim.lsp.buf.declaration, "Goto declaration")
map("n", "gK", vim.lsp.buf.signature_help, "Signature help")
map({ "n", "x" }, "<leader>ca", vim.lsp.buf.code_action, "Code action")
map("n", "<leader>cr", vim.lsp.buf.rename, "Rename")
```

The leader key is space, and the keymaps I actually use are few:

| Keys               | Action                              |
| ------------------ | ----------------------------------- |
| `;f` / `;r` / `;b` | find files / recent files / buffers |
| `jk` (insert)      | leave insert mode                   |
| `Ctrl-hjkl`        | move between windows                |
| `Alt-j` / `Alt-k`  | move the current line or selection  |
| `<leader>q`        | close the buffer                    |
| `<leader>yc`       | copy the diagnostic on this line    |
| `te`               | new tab                             |

A few options change the feel more than any plugin:

```lua
opt.relativenumber = true
opt.scrolloff = 4
opt.sidescrolloff = 8
opt.wrap = true
opt.linebreak = true
opt.breakindent = true
opt.undofile = true
opt.splitkeep = "screen"
opt.clipboard = vim.env.SSH_CONNECTION and "" or "unnamedplus"
```

`splitkeep = "screen"` stops the viewport from jumping when a split opens. `smoothscroll` keeps long wrapped lines from lurching. The clipboard line is the one I am happiest with: over SSH, `unnamedplus` would try to reach a clipboard that does not exist and slow down every yank, so it is disabled when `SSH_CONNECTION` is set.

Folds are treesitter-based and open by default, the command line is hidden (`cmdheight = 0`) with pending keys routed to the statusline, and floats get rounded borders. The tabline is a small custom function that prints only the file name, with its icon, and a `+` when the buffer is modified — no close buttons, no full paths.

The previous LazyVim configuration is kept in the same repository and run with `NVIM_APPNAME=nvim-lazyvim nvim`. Nothing is lost by moving on, and I can compare behavior when something feels wrong.

## Starship: the prompt

The prompt answers three questions in one line: who am I, where am I, and what state is the repository in.

```toml
format = """
$username\
$directory\
$git_branch\
$git_status\
$nodejs\
$python\
...
$line_break\
$character
"""
```

Language modules only render when their files are present, so a Python project shows a Python version and a Go project shows Go. That is the whole reason to use Starship instead of a hand-written prompt: the same config is correct in every repository.

The directory truncates to two levels with `.../` for anything deeper, which keeps deep `node_modules` paths from pushing the prompt off screen. Git status uses short glyphs — `↑` ahead, `↓` behind, `?` untracked, `!` modified, `+` staged, `✘` deleted — so the prompt stays one line.

The character is mode-aware:

```toml
[character]
success_symbol = '[>](green)'
error_symbol = '[>](bold red)'
vimcmd_symbol = '[<](green)'
```

A green `>` when the last command succeeded, a red one when it failed, and a `<` when Neovim is in normal mode. That last one is a small thing that removes a surprising amount of mode confusion.

## The shell around them

Zsh is the glue. The rule for every integration is the same: load only if the tool exists.

```zsh
if (( $+commands[zoxide] )); then
  eval "$(zoxide init zsh)"
fi

if (( $+commands[starship] )); then
  eval "$(starship init zsh)"
fi
```

That guard is why the same `.zshrc` works on a fresh machine, a work laptop, and a Linux box without a pile of conditionals or errors on startup. Homebrew and Linuxbrew are detected the same way, and pyenv, nvm, and Bun are all optional.

Three substitutions do most of the daily work:

- `eza` replaces `ls`, with icons, and falls back to `ls -G` or `ls --color=auto` when `eza` is missing.
- `fzf` provides `Ctrl-x Ctrl-f` for file selection, and `zoxide` turns `z` into a jump to a directory I have visited before.
- `zsh-autosuggestions` pulls completions from history, and `zsh-syntax-highlighting` is sourced last so it can wrap every other editing widget.

History is large and shared across sessions: 50,000 entries in memory, 10,000 saved, appended rather than overwritten. Duplicates and commands that start with a space are not recorded, which is a quiet way to run something without leaving a trace in history.

Fastfetch is configured but not started automatically — the line is commented out in `.zshrc`. I like the setup being visible on demand more than on every new shell.

## Use it at your own risk

Everything above describes one machine's opinion. Copying it wholesale is not a shortcut to a working setup, and you should treat it as a reference rather than an installer.

The files assume things that are true here and may not be true for you: Neovim 0.12 or newer for `vim.pack`, `tree-sitter-cli` and a C compiler so parsers can be built, a Nerd Font v3 or newer so the icons render as anything other than boxes, and `pbcopy` on macOS or `wl-copy` on Wayland for the clipboard bindings. Where those are missing, the configuration usually fails quietly instead of telling you why.

A few choices are actively unfriendly if you paste them without reading. `unbind C-b` removes tmux's default prefix, so if the replacement does not take effect your session looks broken. Linking a directory that already exists creates the nested-link trap described earlier, where the old configuration keeps loading from a path you thought you had replaced. The `link_config` helper refuses to overwrite for exactly that reason, which means it also will not clean up after you.

So read before you copy, back up anything you replace, and change one thing at a time. Take what is useful and leave the rest. If this breaks your shell, your editor, or your afternoon, that is on you — not on me.
