# My lock screen

Derived from Omarchy 4.0.4-1's `/usr/share/omarchy/shell/plugins/lock` on
2026-09-17. Omarchy code copyright David Heinemeier Hansson, MIT license;
preserve the repository's Omarchy attribution. XPS-only deployment for now.

## Boundaries

`Service.qml` retains the stock session lock and password/fingerprint flows.
`FaceObserver.qml` receives only the username and observation eligibility;
PAM success updates telemetry and never calls the lock's unlock function.
`FaceStatus.qml` lives inside the existing lock surface. It uses stock UI
controls and styling without a new popup window. No real face-unlock switch.

The dedicated `omarchy-face-observe` PAM service is not included by any real
authentication service. Only its auth operation is used; account, password,
and session operations are denied. Never reuse its success to unlock or to
satisfy sudo/polkit. No observer component accepts password input.

First real key/pointer activity after secure locking starts at most one attempt.
The initial synthetic pointer sample is filtered by stock PointerMoveGate.
The retry icon explicitly requests another. Blanking cancels and rearms for the
next return. The stock pre-suspend lock IPC cancels the current attempt; the
Facelock daemon itself handles logind suspend/camera release. Unlock aborts the
PAM child, and late results are ignored. The ten-second observer deadline is
independent of the backend's five-second recognition/two-second no-face limits.

## Local preferences and logs

Optional `~/.config/omarchy/face-observe.json`:

```json
{"enabled":true,"autoOnReturn":true,"topMargin":20}
```

Missing preferences use those defaults. Set `enabled:false` to hide/stop the
observer, or `autoOnReturn:false` for explicit retries only. `topMargin` is
clamped to 8–120 logical pixels. These preferences cannot enable unlocking.

The dropdown shows ten recent local observations. The helper keeps private,
bounded JSONL at `${XDG_STATE_HOME:-$HOME/.local/state}/omarchy-face-observe/`
(one 1 MiB log plus one rotated log), recording only timestamp, attempt number,
result, and elapsed time. Attempt numbers are process-local. Never commit logs.
Generic PAM rejection cannot distinguish every backend failure: detailed
root-owned Facelock diagnostics remain in its journal/audit log, not this panel.
Images, embeddings, credentials, and raw PAM messages are not logged by us.

## Stock updates

`check-upstream` is the same sorted-filename/SHA-256 comparison as `andre.agents`.
It checks the installed stock lock files on secure locking and dropdown opening,
asynchronously with a two-second deadline. It never uses the network. A changed
baseline displays an amber wrench; check failure is `unknown` in the dropdown.
Shared stock UI is imported live; the hash covers the copied lock plugin only.

Review stock diffs, merge applicable changes, and test password authentication
before updating `upstream.sha256`. Never advance the hash to suppress the icon.
Record the newly reviewed package version here. Generate the reviewed baseline:

```bash
(cd /usr/share/omarchy/shell/plugins/lock && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d ' ' -f 1)
```

## Verification and recovery

Run `node tests/run.cjs` and `bash tests/runtime.sh` inside this component, `bash -n observation-log
check-upstream`, `omarchy plugin validate PATH`, and QML render/runtime checks.
Tests compare the critical auth functions with installed stock, so a changed
stock implementation calls for review rather than weakening assertions.
Use `omarchy-shell lock preview` to preview (no camera); Escape closes it.
Check `omarchy-shell lock status` for `customization: andre.lock`, version and
observation state. Do not mistake catalog `active:false` for failure: the host
intentionally hides authentication services from the ordinary service map.

Authentication plugins can stay loaded across rescans. After deploying committed
files, restart the shell only while unlocked and confirm the running identity.
Never restart a live locked shell to apply an update. Return to stock while
unlocked with `omarchy plugin enable omarchy.lock` and `omarchy restart shell`.
Remove only our PAM entry using `sudo facelock pam remove --service
omarchy-face-observe`, then delete the dedicated service after checking its
contents. Facelock backend/enrollment removal is a separate explicit action.
