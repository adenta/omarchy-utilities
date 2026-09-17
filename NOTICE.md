# Origins and licenses

- Omarchy-derived configuration, bar, clock, idle/background plugins, and
  screensaver launcher/controller originated from Omarchy 4.0.3 (some personal
  clones were created on 4.0.2): https://github.com/basecamp/omarchy. Preserve the MIT notice
  in `licenses/Omarchy-MIT.txt` with these components.
- The Agents panel is an MIT-licensed clone of the installed Omarchy Agents
  widget captured on 2026-09-17; its source fingerprint is retained in
  `andre.agents/upstream.sha256`, and the Omarchy MIT notice is also included
  beside the plugin.
- System Pulse derives from Fernando Menolli's omarchy-htop. Its existing MIT
  license and source notes remain beside the plugin.
- The Backups and Credits panels retain their existing MIT license files.
- Pokémon artwork derives from gunzf0x/PokeASCIILogin at revision
  `0f963e21132ee1de827643d18442b94020367050`. Its GPLv3 license and artwork manifest
  remain in `files/.local/share/omarchy-pokemon-screensaver/`. This license covers
  the unscaled inputs in `sources/pokemon-ascii/` and the generated Braille
  silhouettes produced by `tools/normalize-pokemon.mjs`; the root license does
  not replace it. Pokémon names and characters belong to
  their respective rights holders; this project is unaffiliated fan customization.
- The two orb wallpapers are the existing personal wallpapers imported with this
  setup. No third-party software or personal runtime state is embedded in them.
- VoxType and Codex Ops program code are not included. Follow their respective
  repositories for source, licensing, releases, and maintenance.

New repository documentation, integration code, and tests use the root MIT
license. Existing component licenses and copyright notices retain precedence.
