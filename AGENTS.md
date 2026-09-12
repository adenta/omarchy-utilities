# Shared Omarchy utilities

This public repository is the maintained source for the components listed in
README.md. It is separate from Codex Ops, VoxType, and Deck Builder Lite.

When asked to change a shared component, implement it here, run its relevant
checks, commit and push, and copy the affected committed files to **XPS and
Grace in the same task**, unless the user explicitly limits the scope. Verify
both installations. Report an unavailable machine as pending; do not claim both
are updated. Do not create an automatic updater, installer framework, status
service, or additional skill.

Use ordinary SSH and selective file copying. Inspect the destination first,
preserve unrelated edits, and save rollback copies before replacement. Use the
existing configured identities: desktop settings belong to `andre`; privileged
changes use the host's established administrator route. Never copy an entire
home directory or use broad deletion to make machines match.

Read the installed Omarchy skill for desktop changes. Never edit packaged
`/usr/share/omarchy` files. Personal integration files, monitor configuration,
power settings, credentials, and runtime data are not wholesale deployment
targets. `examples/` documents settings to merge; it is not an overlay.

The repository contains no credentials, real backup destination or recovery
item identifiers, device pairings, account authentication, logs, or backup and
screensaver history. Keep those local. Use the installed Codex Secrets skill for
1Password work. Preserve attribution and component licenses.

Prefer updating only the affected component. Apply on XPS and verify it before
applying the same commit on Grace. Reload only affected components, and use
`hyprctl reload` plus `hyprctl configerrors` for Hyprland changes. Avoid closing
user windows or interrupting transfers while checking behavior.
