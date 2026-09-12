# Home backup setup

The helper backs up the desktop home only. It does not read the separate agent
home. Use a dedicated encrypted Backblaze B2 repository and independent
credentials for each machine. Never put the real bucket, repository URL,
credential values, or 1Password item identifiers into this public repository.

Local `~/.config/omarchy-backup/config.json` has `source`, `bucket`, and
`repository` fields. Set source to the desktop user's home and repository to
the bucket's Restic location using the S3 endpoint. Local `excludes` excludes
caches, Trash, and the helper's private state/log directory. Keep personal files
and projects included. Preserve existing exclusions on already-configured hosts.

Use the installed Codex Secrets workflow to create and read back a recovery item
in personal 1Password. Record its item ID, vault ID, and verification time in
local `recovery.json` only after verifying the saved credential values.

Store two items in the desktop login keyring:

- `application=omarchy-backup provider=backblaze bucket=BUCKET`: JSON containing
  `keyId` and `applicationKey`, with the B2 key restricted to that bucket.
- `application=omarchy-backup provider=restic bucket=BUCKET`: independent random
  Restic encryption password.

Supply secret values through stdin, never command arguments, shell history, or
task output. Backups wait when the login keyring is locked; this remains a
desktop user service, not a boot-time system backup service.

Run `omarchy-backup init` only against the newly configured repository, then
`systemctl --user enable --now omarchy-backup.timer`. Use `omarchy-backup now` for
the first backup. The helper checks every 15 minutes, backs up after 24 hours,
and performs weekly retention and metadata-integrity checks. It retains 30 daily,
12 weekly, and 12 monthly successful recovery points. Incomplete snapshots cannot
displace successful ones. Notifications flag 48 hours without a successful backup.

System batteries at or below 30% pause work unless on AC. Peripheral batteries
are ignored. A desktop without a system battery is allowed; unreadable capacity
on a real system battery still blocks work.

Before calling setup complete, confirm a successful first backup, run a repository
check, and restore a selected harmless file into a temporary directory and compare
its contents. Grace starts with fresh state; do not copy XPS history, keyrings,
inventory, caches, or snapshots. A normal home backup includes ~/.config and other
personal files; the *source repository* excludes secrets, not the encrypted backup.
