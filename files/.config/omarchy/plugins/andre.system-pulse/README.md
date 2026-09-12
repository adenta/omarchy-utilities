# System Pulse

Live CPU, memory, and process panel adapted from omarchy-htop. Uses process start times alongside PIDs so recycled PIDs do not inherit old CPU samples.

Source and deployment: https://github.com/adenta/omarchy-utilities (read AGENTS.md).
Install this directory at ~/.config/omarchy/plugins/andre.system-pulse. Dependencies: Quickshell, bash, htop, and the Linux /proc filesystem.

Run node tests/run.js in this directory and omarchy plugin validate with this directory's path. Then open the panel and verify process display and the htop launcher.

Preserve LICENSE and UPSTREAM.md. Review upstream changes explicitly; do not use the plugin marketplace to overwrite this local fork.
