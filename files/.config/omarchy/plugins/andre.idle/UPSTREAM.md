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

Omarchy 4.0.3 compatibility: read the public `shell.idleConfig` interface.
Retain the earlier `shell.shellConfig.idle` lookup for machines using the older
shell interface. Idle timeout values stay in each machine’s `shell.json`.

## Startup update notification

Reviewed against installed Omarchy 4.0.4-1 on 2026-09-17. The stock differences
are the personal screensaver launcher and configuration-interface precedence
described above, plus this independent maintenance check.

Five seconds after each service startup, `check-upstream --notify` compares
sorted filenames and SHA-256 hashes of the installed stock idle plugin (including
helpers) against `upstream.sha256`. The comparison has a two-second timeout.
Unchanged stock is silent; changed stock or an unavailable check produces a normal
desktop notification. Delivery failures are logged without retrying. Each boot
or service reload checks again, with no deduplication, polling, or network access.
Idle, lock, and wake handling never wait for this check.

Only the stock idle directory is tracked, not the custom screensaver launcher or
shared shell dependencies. Updates during a session are checked on the next
service startup. Different installed versions can legitimately notify on only
one machine.

Review stock changes, merge applicable fixes, and verify idle/screensaver/lock
behavior before explicitly updating the baseline and reviewed version here.
Never advance the baseline simply to hide a notification:

```sh
(cd /usr/share/omarchy/shell/plugins/services/idle && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d ' ' -f 1) > upstream.sha256
```

Run `node tests/run.cjs`, `bash -n check-upstream`, and
`omarchy plugin validate .` from this plugin directory before deployment.
