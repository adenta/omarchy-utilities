-- Source: https://github.com/adenta/omarchy-utilities (read AGENTS.md).
-- Opt in on desktops using compositor shortcuts instead of evdev input access.
-- Pair with examples/voxtype-compositor.conf; do not enable both hotkey methods.
o.bind("INSERT", "Toggle dictation", "$HOME/.local/bin/voxtype-deepgram record toggle", {
  non_consuming = true,
})
o.bind("Escape", "Cancel dictation", "$HOME/.local/bin/voxtype-deepgram record cancel", {
  non_consuming = true,
})
