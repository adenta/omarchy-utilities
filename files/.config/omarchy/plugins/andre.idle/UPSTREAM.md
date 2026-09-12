# Local idle-service change

Created from `omarchy.idle` on Omarchy 4.0.2-1 with:

```sh
omarchy plugin clone omarchy.idle
```

The intentional functional difference in this plugin is one command in
`Service.qml`: automatic screensaver launches call
`$HOME/.local/bin/omarchy-pokemon-screensaver` instead of calling
`omarchy-launch-screensaver` directly. That user-owned script chooses one
Pokémon, then delegates to the personal screensaver launcher and packaged renderer.

After Omarchy updates, compare this clone with:

```sh
diff -u /usr/share/omarchy/shell/plugins/services/idle/Service.qml \
  ~/.config/omarchy/plugins/andre.idle/Service.qml
```

Reapply the one launcher-line change to a fresh clone if the upstream idle
service has changed materially. To restore the packaged service immediately:

```sh
omarchy plugin remove andre.idle --yes
```
