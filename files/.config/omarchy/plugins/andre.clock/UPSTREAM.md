# Clock upstream maintenance

Reviewed against installed Omarchy 4.0.4-1 on 2026-09-17.

Preserve second-by-second display, the h:mm:ss AP format, and the existing direct center-hover property integration with the custom bar. Stock also supports a setter-based facade; that is outside this notification change.

Five seconds after each component instance starts, its own checker compares sorted
stock filenames and SHA-256 hashes in `/usr/share/omarchy/shell/plugins/panels/clock`
with `upstream.sha256`. The check has a two-second timeout and never blocks the UI.
Unchanged stock is silent. Changed stock or a failed check produces a normal
desktop notification; delivery failures are logged without retrying. Notifications
may repeat on boot, plugin reload, or additional component instances. There is no
network access, polling, suppression state, or dependency on another custom plugin.

“Current” means the installed stock snapshot has been reviewed, not that this
customization is identical to stock or that shared shell dependencies are unchanged.
Review future stock diffs, merge applicable changes, and test before explicitly
advancing the baseline. Never advance it just to silence a notification.

From this plugin directory, after review:

```sh
(cd /usr/share/omarchy/shell/plugins/panels/clock && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d ' ' -f 1) > upstream.sha256
node tests/run.cjs
bash -n check-upstream
omarchy plugin validate .
```
