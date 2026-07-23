---
title: I'm building Dino, a small AI CLI for my terminal
description: Notes on turning everyday Git and writing workflows into small local-first commands
slug: dino-cli
tags:
  - tech
heroImage: dino-cli/hero-v2.svg
createdAt: 2026-06-18
layout: ../../layouts/BlogPost.astro
---

## The idea

Dino is a small CLI tool I have been building for my own workflow. The goal is not to make a dashboard, a SaaS product, or a tool that tries to take over my work. I want something that sits close to the terminal and helps with boring but useful tasks.

__Trivia__: `Dino` is my girlfriend's nickname lol.

The shape I have in mind is:

```text
git + jq + curl + AI
```

That means Dino should feel like a normal command-line tool first. It should read local files, inspect local Git changes, print useful output, and stay easy to combine with other commands.

## Why a CLI

I like tools that do one focused job and then get out of the way. A browser app can be nice, but for developer workflows, the terminal is already where a lot of the context lives. Git is there. Files are there. Environment variables are there. The current directory matters.

So Dino starts from that place instead of trying to replace it.

The first useful command is:

```sh
dino commit
```

It reads the current Git diff and asks an AI model to suggest a Conventional Commit message.

For example, after changing the Go module path, Dino suggested:

```text
build(go): update module path to GitHub repository
```

That is a small thing, but it fits the kind of friction I want Dino to remove. I still review the message. I still decide whether to use it. Dino just gives me a good starting point.

## Local-first by default

The important rule is that Dino should not act like an autonomous agent. It should assist, not take over.

For the Git workflow, that means:

- It can read `git diff`.
- It can explain or suggest a commit message.
- It should not push code.
- It should not rewrite history.
- It should not create a commit without confirmation.

Right now, `dino commit` only prints the message. It does not run `git commit` for me. That is intentional while I am still shaping the workflow.

## Keeping secrets out of the code

One small but important step was moving API configuration out of the source code.

Instead of hardcoding a key or private endpoint, Dino reads from environment variables:

```sh
export DINO_OPENAI_API_KEY="your-api-key"
export DINO_OPENAI_RESPONSES_URL="https://api.openai.com/v1/responses"
```

In Go, that is just `os.Getenv(...)`, but the habit matters. Source code can go to GitHub. Local secrets should stay in the shell, a local `.env` file, or another private configuration layer.

The code now has a safe default endpoint for the OpenAI Responses API, while a custom OpenAI-compatible endpoint can be supplied from the environment.

## Making the CLI feel alive

I also added small process messages.

Not a progress bar. Not a giant animated UI. Just enough feedback to make the command feel less like it froze:

```text
dino: checking the diff before making any claims
dino: using unstaged changes
dino: asking the model for a conventional commit message
dino: message ready
```

Those messages are printed to `stderr`, while the actual commit message goes to `stdout`. That split matters because it keeps Dino scriptable:

```sh
dino commit > message.txt
```

The user sees friendly status output in the terminal, but scripts can still capture only the useful result.

## The direction

The bigger version of Dino has two workflows in mind.

For content:

```text
source
-> fetch
-> summarize
-> draft
-> export
```

For Git:

```text
git diff
-> analyze
-> summarize
-> commit
-> PR
-> release notes
```

I am starting with the smallest useful pieces instead of building the whole map at once. That makes the project easier to learn from. Each command needs to earn its place.

## What I am learning

The main lesson so far is that a CLI is mostly about boundaries.

What should be printed to `stdout`? What should go to `stderr`? What should come from environment variables? What should be a flag? What should the tool refuse to do automatically?

Those questions sound small, but they decide whether the tool feels composable or messy.

Dino is still early, but it already has a clear direction: small local commands, AI where it helps, and the human still in control.
