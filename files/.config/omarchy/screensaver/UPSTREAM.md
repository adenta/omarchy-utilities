# Screensaver launcher upstream maintenance

Reviewed against Omarchy 4.0.4-1 on 2026-09-17. The launcher preserves the stock
launch guards, monitor-focus handling, and window-event synchronization while
adding Pokémon selection, the personal renderer, monitor-based font sizing, and
terminal fullscreen/padding options.

After its launch guards pass, launch starts its own check-upstream --notify in
the background without waiting. Each invocation may notify again. The checker
hashes only the installed /usr/share/omarchy/bin/omarchy-launch-screensaver file
(name and content), with a two-second timeout. Unchanged stock is silent; changed
stock or an unavailable check produces a normal desktop notification. Delivery
failures are logged without retrying. No network, polling, or suppression state.

This does not track the stock renderer, terminal configs, or idle service.
Review changes, merge applicable fixes, and test before explicitly updating the
baseline; never update it just to silence a notification. From this directory:

```sh
(cd /usr/share/omarchy/bin && sha256sum -- omarchy-launch-screensaver | sha256sum | cut -d ' ' -f 1) > upstream.sha256
node tests/upstream.cjs
bash -n launch check-upstream
```
