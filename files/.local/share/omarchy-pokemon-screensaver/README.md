# Omarchy Pokémon ASCII screensaver artwork

This directory contains normalized Pokédex entries 001–251 from PokeASCIILogin.
The original filled silhouettes are proportionally enlarged to fit within
**70 columns × 22 rows** for Omarchy's `ttfx` screensaver. Empty outer borders
are cropped; gaps inside each silhouette are ordinary spaces.

- Source: https://github.com/gunzf0x/PokeASCIILogin
- Source revision: `0f963e21132ee1de827643d18442b94020367050`
- License: GNU GPL v3 (see `LICENSE`)
- Installed artwork: `art/001-bulbasaur.txt` through `art/251-celebi.txt`

`manifest.tsv` records each Pokédex number and source filename stem.

## Regenerating the artwork

The maintained repository keeps unscaled inputs in `sources/pokemon-ascii/`.
Run `node tools/normalize-pokemon.mjs` to regenerate `art/`, or add `--check`
to verify it without changes. These are build-time tools; the screensaver
reads the generated files directly.

Each input is decoded into its 2×4-dot Braille mask. The converter measures
the visible dots, fits the silhouette proportionally inside 140×88 dots using
nearest-neighbor sampling, centers it, and re-encodes it as Braille. Wide
silhouettes use more horizontal space; already tall silhouettes stay similar
in size. The target matches the approved normalization previews. No new art,
interior shading, or grayscale is introduced. Empty cells become ordinary
spaces, and completely empty outer cell borders are removed. Cropping preserves
every visible Braille character and the approved silhouette size. Do not use
U+2800 Braille blanks: stock `ttfx` treats them as artwork targets, causing
Laser Etch and Decrypt to animate invisible gaps and padding. The terminal
centers the cropped artwork; text file dimensions vary by silhouette.

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
maintained repository. It retains the initial terminal
resize wait, cursor handling, and input/focus dismissal. Local additions are
artwork rotation and waiting for each child PID to check successful completion.
Rendering or selection failures stop the screensaver instead of continuing to
consume selections. The animation engine is still the packaged `ttfx` binary;
no packaged Omarchy files are modified. Compare this controller against the
packaged script when reviewing future Omarchy updates.

The launcher sizes the screensaver font from each monitor's logical height:
`logical_height * 13 / 600` points, rounded to the nearest tenth and bounded to
8–18 points. Rotated monitors use their effective vertical dimension. This
calibration gives XPS/Ghostty (800 logical pixels tall) a 17.3-point font and a
91×26 grid, and Grace/Foot (720 logical pixels tall) a 15.6-point font and a
103×26 grid. Both have 26 genuinely visible rows; the approved artwork heights
are even, so stock TTFX centers them vertically within those grids. Font
metrics vary across terminals and displays; verify actual dimensions after
changing fonts, terminals, display scale, or resolution. Regular terminal
fonts and desktop scaling are not changed.

Ghostty and Foot launch fullscreen and balance leftover pixels around the text
grid. The renderer uses `--canvas-width 0 --canvas-height 0` and clears inherited
`COLUMNS`/`LINES` overrides, so TTFX uses the real viewport and can adapt to a
resize. Never round the canvas height up: that hides the bottom row from
effects such as Orbitting Volley and Laser Etch. On an odd-height viewport,
accept stock TTFX's upward rounding rather than cropping an effect row.
Rings is excluded with stock `--exclude-effects rings`; all other random
effects and their defaults remain available.

`node tests/pokemon-centering.js` checks all 251 artworks using the installed
`ttfx` binary, including complete visible artwork, ordinary-space gaps, the
two deployed grids, and odd/even terminal dimensions. Stock horizontal
anchoring can leave a two-column margin difference for odd-sized text on an
odd-width terminal.
Allow at least 70 columns and 22 rows to fit the entire artwork collection;
verify the font setting before using a narrower display.

`node tests/pokemon-effects.js` checks every frame of Laser Etch, Decrypt, and
Orbitting Volley on Zapdos, Aerodactyl, Sandshrew, and Caterpie at both deployed
grid sizes, plus an odd-height bottom-edge regression. Laser targets and decrypted
characters must fall on visible artwork; surrounding laser beams and sparks
can still travel across the screen. The bottom Orbitting Volley launcher must
remain visible on the last row.

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
