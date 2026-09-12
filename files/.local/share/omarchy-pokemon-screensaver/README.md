# Omarchy Pokémon ASCII screensaver artwork

This directory contains Pokédex entries 001–251 from PokeASCIILogin. The
artwork was copied without installing or running the upstream program. Line
endings and trailing whitespace were normalized for use with Omarchy's `ttfx`
screensaver.

- Source: https://github.com/gunzf0x/PokeASCIILogin
- Source revision: `0f963e21132ee1de827643d18442b94020367050`
- License: GNU GPL v3 (see `LICENSE`)
- Installed artwork: `art/001-bulbasaur.txt` through `art/251-celebi.txt`

`manifest.tsv` records each Pokédex number and source filename stem.

## Omarchy integration

`~/.local/bin/omarchy-pokemon-select` uses GNU `shuf` to shuffle all 251
artworks, then selects each one once before shuffling a new cycle. Cycles are
independent, so a Pokémon may repeat across a cycle boundary, including twice
in a row.

Progress survives launches and reboots in
`~/.local/state/omarchy-pokemon-screensaver/cycle-state`: the first line is the
last selected filename and the remaining lines are the shuffled, unshown
filenames. This is plain data, not shell code or a viewing history. The first
selection imports the old `last-selection`, counts that Pokémon as already
shown, and removes the old file after successfully saving the new state.

Selection is locked across callers. The picker prepares temporary artwork and
state files, atomically replaces `~/.config/omarchy/branding/screensaver.txt`,
then atomically replaces the state file. Invalid or duplicate saved filenames
produce an error without resetting progress. Progress tracks selections, not
confirmed display: a failed launch may consume a selection, and interruption
between the two file replacements can leave the artwork ahead of the queue.

`~/.local/bin/omarchy-pokemon-screensaver` chooses once per screensaver
session, then delegates to the personal launcher and Omarchy's renderer. Omarchy
therefore retains its stock animation, color, input, and shutdown behavior;
the same Pokémon remains in place while that session cycles through effects.

The selector still prints the selected filename by default or its full path
with `--path`. The launcher's `--pick-only` selects without opening a window.

The user-owned `andre.idle` clone calls this picker for automatic idle launches.
The original `omarchy.idle` service remains untouched.

To restore the stock idle service, run:

```sh
omarchy plugin remove andre.idle --yes
```

The clone is backed up by that command.

## Maintained source

https://github.com/adenta/omarchy-utilities — read AGENTS.md and update both XPS and Grace. Scripts live in files/.local/bin; the idle plugin and launcher live in files/.config/omarchy. Runtime rotation state is local and must not be copied.
