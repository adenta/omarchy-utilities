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

`~/.local/bin/omarchy-pokemon-screensaver` delegates to the personal launcher,
which selects the first Pokémon after checking whether it can launch. Every
monitor starts with the same artwork. The personal `screensaver/render` script
plays three completed effects per Pokémon, then selects the next artwork.
Monitors advance independently through the shared, locked queue. Each renderer
uses the original artwork path, so another selection cannot replace its input.
The three-effect counter resets on each launch; queue progress remains saved.

The controller derives from the 48-line `bin/omarchy-screensaver` installed by
Omarchy **4.0.3-1**, with its MIT notice in `licenses/Omarchy-MIT.txt` in the
maintained repository. It retains the stock animation settings, initial terminal
resize wait, cursor handling, and input/focus dismissal. Local additions are
artwork rotation and waiting for each child PID to check successful completion.
Rendering or selection failures stop the screensaver instead of continuing to
consume selections. The animation engine is still the packaged `ttfx` binary;
no packaged Omarchy files are modified. Compare this controller against the
packaged script when reviewing future Omarchy updates.

The selector still prints the selected filename by default or its full path
with `--path`. The launcher's `--pick-only` selects without opening a window.

The user-owned `andre.idle` clone calls this wrapper for automatic idle launches.
The original `omarchy.idle` service remains untouched.

To restore the stock idle service, run:

```sh
omarchy plugin remove andre.idle --yes
```

The clone is backed up by that command.

## Maintained source

https://github.com/adenta/omarchy-utilities — read AGENTS.md and update both XPS and Grace. Scripts live in files/.local/bin; the idle plugin and launcher live in files/.config/omarchy. Runtime rotation state is local and must not be copied.
