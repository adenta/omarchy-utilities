# Observation-only face recognition (XPS)

The independent `andre.lock` component adds icon-only camera status, retry,
and an expandable telemetry panel near the top center of the stock lock screen.
It never unlocks on face recognition. Password/fingerprint behavior stays stock.
Source lives under `files/.config/omarchy/plugins/andre.lock`; install only the
chosen component. Grace is excluded from this deployment.

## Backend

Use the normal AUR `facelock-bin` package (0.2.1 at initial deployment), updated
by the normal Omarchy/yay AUR update flow. No vendored or pinned Facelock binary.
The XPS 13 DX13260 exposes a 360×360 GREY/15 fps IR camera. Use Facelock's own
auto-selection and normal enrollment at everyday typing distance. Standard CPU
models are SCRFD 2.5G (`scrfd_2.5g_bnkps.onnx`) and ArcFace R50
(`w600k_r50.onnx`). Keep upstream IR, matching and movement security defaults.

Configure with `facelock setup --no-pam`; do not run the generic PAM wizard.
Our sole PAM target is `omarchy-face-observe`, created with a deny terminator
and account/password/session denial. Then run Facelock's supported
`pam add --service omarchy-face-observe` to insert its auth module. No sudo,
polkit, login, or shared PAM changes are part of this feature.

Local configuration in `/etc/facelock/config.toml` uses daemon mode with a
15-second idle exit and no boot enablement. The packaged D-Bus activation starts
it on demand. No custom background listener, continuous scan, or network poll.
Set both camera release intervals to zero, notifications off, snapshots off,
and audit enabled with 1 MiB rotation. Models and encrypted enrollments remain
in Facelock's own protected locations. Normal enrollment:

```bash
sudo facelock enroll --user "$USER" --label "Everyday"
```

0.2.1 setup can report encryption configured while its keyfile is absent.
Confirm absence as root before using the upstream
`facelock tpm encrypt --generate-key` command; never replace an existing key.
This deployment keeps Facelock's normal keyfile encryption, not plaintext.

## Documented UWSM exception

On XPS we reproduced Facelock 0.2.1 rejecting the Quickshell PAM caller with
`NoSessionForPID` before camera capture. UWSM places the desktop under the user
manager rather than the logind session scope. On 2026-09-17 the user explicitly
approved the community workaround for this observation-only configuration:
`security.abort_if_ssh = false`.

The local config comment records the failure, the user's approval, and removal
criteria. This disables the daemon's local-session check: same-account remote
processes can request camera scans too. Face matching, IR, movement checks and
UID checking remain. No real authentication service consumes the result here.
Re-enable session verification when upstream supports the UWSM layout. Reassess
this exception before enabling any real face unlock or sudo/polkit integration.
Never silently propagate this machine-specific setting to another host.

See the community [exact-model integration](https://github.com/therealasclepius/omarchy-face-unlock#optional-compatibility-and-movement-settings)
and upstream [Facelock integration contract](https://github.com/tyvsmith/facelock/blob/v0.2.1/docs/integrating.md).
We do not install that community plugin's real-unlock wiring or privileged helper.

## Updates and operations

The plugin's MAINTENANCE.md documents local UI preferences, logging, stock hash
checks, rollback, and tests. Facelock updates normally; our cloned lock changes
are reviewed when the installed stock hash changes. Shared UI imports remain
stock. Camera failures, missing enrollment, and telemetry errors never gate
password authentication.
