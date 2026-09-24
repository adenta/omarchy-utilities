# Personal screensaver launcher

`launch` is a copy of `/usr/share/omarchy/bin/omarchy-launch-screensaver`
from Omarchy 4.0.2-1. Its only change adds these Ghostty arguments:

    --scrollback-limit=0 --scrollbar=never

The existing `~/.local/bin/omarchy-pokemon-screensaver` calls this copy.
Both the personal idle plugin and the Screensaver menu item already use
that entry point. Direct calls to the packaged Omarchy launcher remain stock.

After an Omarchy update, compare the launcher against the packaged version
and incorporate relevant upstream changes. Local copies survive updates but
do not automatically receive upstream fixes.

To stop using this clone, set `screensaver_launcher` in
`~/.local/bin/omarchy-pokemon-screensaver` back to
`/usr/share/omarchy/bin/omarchy-launch-screensaver`.
