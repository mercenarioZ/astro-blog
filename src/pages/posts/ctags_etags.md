---
title: Ctags and Etags
description: Understanding tags as a generated symbol index for fast source-code navigation
slug: ctags-etags
tags:
  - tech
createdAt: 2026-08-19
layout: ../../layouts/BlogPost.astro
---

# ctags and etags finally clicked when I understood the index

I used to think “Vim jumps to definitions” or “Emacs finds symbols.” That describes the interface, but not the mechanism.

The mechanism starts with four terms:

- A **symbol** is a named object in source code: a function, class, struct, macro, or variable.
- A **tag** is an index entry for one symbol. It says where that symbol can be found.
- A **tags table** is a file containing many tag entries.
- `ctags` and `etags` are programs that generate those tables.

The central idea is separation in time:

```text
indexing time:
source files -> ctags or etags -> tags table

navigation time:
name under cursor -> editor looks in table -> file + address -> jump
```

The expensive discovery work happens before I press the jump key. At navigation time, the editor performs a lookup in an already generated index.

## The three-layer model

It helps to keep three layers separate:

```text
1. Source code
   The real functions, types, macros, and variables.

2. Generated index
   A compact name -> location mapping stored in tags or TAGS.

3. Editor interface
   CTRL-] in Vim, M-. in Emacs, or another command that queries the index.
```

The editor command is not the indexer. The indexer is not the source of truth. The source code is the source of truth; the table is only a generated snapshot of it.

That distinction explains both the speed and the failure modes of tags.

## What does ctags actually extract?

`ctags` scans source files with language-specific parsers and looks for named language objects. In C, those can include functions, macros, typedefs, structs, unions, enums, and variables, depending on the implementation and options.

Given this source:

```c
int add(int left, int right) {
    return left + right;
}
```

the useful information is approximately:

```text
name:     add
kind:     function
file:     mathy.c
address:  the line containing the definition
```

This is more structured than blindly searching every file for the text `add`, because the parser attempts to recognize a function definition. But it is less complete than compiling the program.

A classic tags table usually does not know the full meaning of the program. It does not need to prove which overload a call resolves to, infer every type, or maintain live knowledge of imports. Its main job is much smaller:

> Extract useful names and remember where they were found.

## A tag is an index record, not the source symbol

The function `add` and the tag for `add` are not the same object.

```text
source symbol                         generated tag
-------------                         -------------
int add(int left, int right)          add -> mathy.c -> address
```

If I delete the tag file, the function still exists. I only lose the shortcut used to locate it.

If I delete or rename the function but keep the old tag file, the tag still exists, but it points to information that is no longer true.

That is why “tag” is best understood like an entry in a book index. The index entry is not the chapter; it tells me where to look for the chapter.

## Anatomy of a vi-style tag entry

A vi-style `tags` file contains one record per line. With real tab characters rendered as `\t`, an entry can look like this:

```text
add\tmathy.c\t/^int add(int left, int right) {$/;"\tf
```

Its general shape is:

```text
<name>  <file>  <Ex address>;"  <optional metadata>
```

The fields mean:

- `add`: the lookup key
- `mathy.c`: the file to open
- `/^int add...$/`: an Ex search command used to locate the definition
- `f`: metadata saying that this tag is a function

The address is not a machine-memory address. It is an editor instruction, commonly a line number or a text search pattern.

The `;"` marker separates the original three-field format from newer metadata. Older vi implementations can use the first part, while newer clients can also read information such as symbol kind and scope.

The file can also contain pseudo-tags beginning with `!_TAG_`. These describe the table itself, including its format and whether entries are sorted.

## Why lookup is fast

Without an index, a tool may need to scan many source files when I ask for `add`. With a tags table, discovery has already happened.

The editor can perform a much smaller sequence:

```text
1. Read the name under the cursor: add
2. Look up add in the tags table
3. Read its file and address
4. Open the file
5. Execute the stored address
```

Sorted vi-style tables can support binary search by tag name. More importantly, the editor does not need to parse the entire project again for every jump.

## ctags and etags share the idea, not the file format

The names are confusing because they can refer to commands, formats, or tool families. The clean separation is:

| Part | Vim tradition | Emacs tradition |
| --- | --- | --- |
| Generator | `ctags` | `etags`, or `ctags -e` |
| Conventional output | `tags` | `TAGS` |
| Consumer | Vim and other vi-like tools | Emacs through its tags/xref support |

Both sides implement the same broad pattern:

```text
source files -> generator -> persistent symbol index -> editor
```

The formats differ because their editor ecosystems evolved differently. Uppercase `TAGS` is not simply a renamed lowercase `tags`; its internal format is designed for Emacs.

Modern Emacs exposes navigation through `xref`. An etags table can be one `xref` backend, while Eglot can provide another backend through a language server. The same `M-.` interface therefore does not guarantee that etags is doing the lookup.

## Experiment 1: Generate both indexes

A tiny source file is enough:

```sh
mkdir -p /tmp/tags-lab
cd /tmp/tags-lab

cat > mathy.c <<'EOF'
int add(int left, int right) {
    return left + right;
}

int main(void) {
    return add(2, 3);
}
EOF
```

Generate both formats with Universal Ctags:

```sh
ctags -o tags mathy.c
ctags -e -o TAGS mathy.c

ls -l tags TAGS
grep '^add' tags
```

The interesting result is not the exact bytes, which vary with implementation and options. It is that two generated artifacts now describe symbols from the same source file.

Vim traditionally reads `tags`. Emacs traditionally reads `TAGS`. Neither file is required to compile or run `mathy.c`; they exist for navigation.

## The snapshot rule

A tags table describes what the generator saw during its last scan:

```text
source at 10:00 -> generate tags -> accurate snapshot
source at 10:30 -> rename add     -> old snapshot remains unchanged
```

The generator does not stay running. The table does not automatically observe edits. This makes tags cheap and offline, but it creates their central maintenance rule:

> When important names or file locations change, regenerate the table.

Small edits inside a function may not break a search-pattern address. Renaming a function, moving its definition, or adding a new symbol is more likely to make the table incomplete or wrong.

Duplicate names create a different problem. Two files may both define `init`. The table can contain both entries, but the editor must choose one or present a match list. A tag name alone is not always a globally unique identity.

## Experiment 2: Break the snapshot

After generating `tags`, rename the function in `mathy.c` from `add` to `sum`, but do not regenerate the table:

```c
int sum(int left, int right) {
    return left + right;
}
```

The files now disagree:

```sh
grep '^add' tags
grep 'int sum' mathy.c
```

The first command can still find the old tag, while the second finds the new source definition. The index is not corrupted; it is faithfully preserving an old observation.

Regeneration restores the agreement:

```sh
ctags -o tags mathy.c
ctags -e -o TAGS mathy.c
```

This small failure explains most surprising tag jumps in real projects: the wrong table, the wrong search order, a duplicate name, or a stale snapshot.

## Tags are not compiler symbol tables or LSP

These tools overlap, but their models are different:

| Model | Typical knowledge | Lifetime | Main strength |
| --- | --- | --- | --- |
| Tags table | Extracted names, files, addresses, optional metadata | Persistent file; stale until regenerated | Cheap offline navigation |
| Compiler symbol table | Scopes, types, declarations, bindings needed during compilation | Usually tied to compilation | Correctly compiling the program |
| Language server | Project state plus language-specific semantic information | Live process or cache | Rich navigation, references, rename, diagnostics |

Tags can reliably answer a narrow question:

```text
“Which indexed locations are associated with this name?”
```

An LSP server tries to answer a more semantic question:

```text
“What program object does this particular use refer to?”
```

Those questions often produce the same jump for simple code. They diverge when overloads, scopes, imports, generated code, macros, or duplicate names matter.

Universal Ctags can emit some reference tags, but support depends on the language and parser. That should not be confused with a general compiler-aware “find all references” guarantee.

## The model I’m keeping

The whole mechanism reduces to:

```text
name -> file -> address
```

`ctags` and `etags` precompute that mapping. Editors query it later. The design is fast because the index already exists, portable because it is stored in a file, and fallible because the file is only a parser-generated snapshot.

Once I separate source symbols, generated tags, and editor commands, the apparent editor magic becomes a small and inspectable indexing system.

## Sources

- [Universal Ctags ctags(1) manual](https://docs.ctags.io/en/latest/man/ctags.1.html)
- [Universal Ctags tags(5): vi tags file format](https://docs.ctags.io/en/latest/man/tags.5.html)
- [Vim Reference Manual: tags and special searches](https://vimhelp.org/tagsrch.txt.html)
- [GNU Emacs Manual: Tags Tables](https://www.gnu.org/software/emacs/manual/html_node/emacs/Tags-Tables.html)
- [GNU Emacs Manual: Xref](https://www.gnu.org/software/emacs/manual/html_node/emacs/Xref.html)
- [Universal Ctags: reference tags](https://docs.ctags.io/en/latest/output-tags.html)
