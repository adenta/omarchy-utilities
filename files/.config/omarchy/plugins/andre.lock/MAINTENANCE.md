# My lock screen

Derived from Omarchy 4.0.4-1's `/usr/share/omarchy/shell/plugins/lock` on
2026-09-17. Omarchy code copyright David Heinemeier Hansson, MIT license;
preserve the repository's Omarchy attribution. XPS-only deployment for now.

## Boundaries

`Service.qml` retains the stock session lock and password/fingerprint flows,
with the deliberate empty-Enter sleep unlock window documented below.
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
Tests compare the critical auth functions with installed stock, normalizing
only the documented empty-Enter branch and unlock-window cleanup. A changed
stock implementation calls for review rather than weakening assertions.
The fullscreen preview and its IPC methods are removed. Use an isolated QML
harness for visual checks, then verify actual locking and password unlocking.
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

## Sleep unlock window (1.1.0, 2026-09-20)

User-authorized behavior: closing an undocked lid or otherwise suspending an
unlocked desktop starts a 15-minute passwordless unlock window. The laptop
still locks before sleeping. Empty Enter may release the secure session lock
during the window; anyone physically present can do this. Nonempty input
continues through the existing password PAM flow. Face observation still
cannot unlock anything. The locked-screen display blanks after 60 seconds.

`BootClock.qml` freshly reads `/proc/uptime` for each decision. This Linux
clock includes suspended time and is independent of wall-clock changes.
Read failure, invalid/backward time, expiry, shell restart and stranded-lock
recovery require authentication. State is memory-only. Repeated sleep requests
never extend a deadline or grant a window to an already locked session. Manual
and ordinary idle lock requests revoke an existing window.

Integration uses `sleep-dispatch` and a private `sleep-ipc/omarchy-shell`
adapter. The adapter translates only the exact `lock lock` request to
`lock lockForSleep`; every other IPC request passes through unchanged.
It is placed on PATH only for the packaged lid and sleep-monitor process
trees, never globally. This preserves packaged display reconciliation,
1Password locking, sleep delay inhibition, and secure-lock status checks.
No packaged Omarchy files are edited or copied for these hooks.

The user Hyprland lid-on binding invokes `sleep-dispatch lid`. The user unit
drop-in `omarchy-sleep-lock.service.d/unlock-window.conf` changes ExecStart
to `sleep-dispatch monitor`. These two routing overrides are required while
this feature exists; review them if upstream changes the lock IPC or stops
invoking `omarchy-shell` through PATH.

Tests: `node tests/run.cjs` includes actual function tests for deadline edges,
duplicate requests, manual/idle/recovery locks, failed clock reads, secure-lock
requirements, and the unchanged nonempty password path. `bash tests/runtime.sh`
still checks observation PAM in isolation. Never test by unlocking a live
user session through agent IPC.

To remove this feature, first restore the stock lid binding and remove the
above systemd drop-in; reload Hyprland and restart the sleep-lock service.
Then remove the unlock-window code or switch to the stock lock plugin while
the desktop is unlocked. No enrollment or PAM changes are needed.

## Two-Enter UX (1.2.0, 2026-09-20)

The sleep unlock window now requires two separate Enter presses within five
seconds. The first shows “Press Enter again to unlock”; timeout returns to the
password field and its small unlock hint. At window expiry the hint disappears.
Expiry while confirmation is pending also shows “Unlock window ended — enter
password” below the field. No countdown or additional controls are shown.

Confirmation, held-key state, and eligibility are shared in Service.qml across
all monitor views. The view consumes Return/Enter before TextInput's default
accept handler, forwards press/release metadata, and forwards other keys to
cancel confirmation. Auto-repeat and another key-down without release cannot
confirm. Nonempty input still follows the stock password PAM path. Returning
from a password attempt resets the held-key gate because a disabled TextInput
may not have received the release.

Both deadlines use BootClock; a 100 ms refresh while the display is awake
updates prompts without input. Wake/input also refresh eligibility. Clock
failure requires a password. Blanking, repeated sleep requests, manual locks,
unlock and restart cancel confirmation. Typing/other keys also cancel it.
Opening the face diagnostics cancels confirmation; face observation remains
isolated from authentication.

Run `node tests/ui.cjs` for isolated Qt key-event tests against the actual
LockView and extracted service functions, including two synchronized views,
release gating, keypad Enter, prompt transitions, password submission and text
fit. Set PREVIEW_DIR to an existing directory to save initial/confirmation/
expiry renders. The harness never acquires a real session lock or calls live
PAM. `node tests/run.cjs` additionally checks the service reset/timing branches.

## Shared away timeout (1.3.0, 2026-09-21)

The ordinary open-lid idle lock and the sleep unlock window now use the same
`idle.lock` value from `~/.config/omarchy/shell.json`. The configured policy is
900 seconds, while `idle.screensaver` remains 150 seconds. Changing the lock
value therefore changes both the idle authentication deadline and the length
of a newly started sleep unlock window. Authentication clones intentionally do
not receive Omarchy's public idle-config capability, so the lock service watches
the same user `shell.json` directly. A missing, malformed, wrong-version, or
invalid lock value falls back to Omarchy's five-minute default.

Accepted quirk: lid close starts a fresh sleep unlock window; it does not carry
forward time already spent in the open-lid idle/screensaver cycle. Someone can
idle for almost 15 minutes, close the lid, and receive almost another 15-minute
two-Enter window, for nearly 30 minutes since last activity without password
authentication. Closing the lid after the ordinary idle lock has already been
acquired does not grant or extend a window. This behavior is deliberate for now
and should not be "fixed" accidentally without revisiting the policy.

## Subtle unlock hint and resume freshness (1.4.0, 2026-09-23)

The password field always starts with “Enter password”. While the sleep unlock
window is current, a small low-contrast “↵ twice to unlock” hint appears below
the field. The first Enter temporarily replaces the field text with the direct
confirmation prompt; expiry and authentication messages retain their stronger
existing treatment.

Blanking closes a separate visual-ready gate before the display turns off.
Output return or user activity reads BootClock and refreshes eligibility before
opening that gate. This prevents the pre-suspend unlock hint from flashing when
the machine resumes after the window has expired. The gate affects presentation
only: every empty-Enter decision still performs its own fresh clock read.
