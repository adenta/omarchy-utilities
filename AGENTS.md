# Shared Omarchy utilities

This public repository is the maintained source for the components listed in
README.md. It is separate from Codex Ops, VoxType, and Deck Builder Lite.

When asked to change a shared component, implement it here, run its relevant
checks, commit and push, then deploy that committed revision with
`deploy/site.yml` to **XPS and Grace in the same task**, unless the user
explicitly limits the scope. Verify both installations. Report an unavailable
machine as pending; do not claim both are updated. Do not create an automatic
updater, deployment daemon, status service, or additional skill.

Use the repository-owned Ansible inventory and host profiles. Preview with
`ansible-playbook deploy/site.yml --check --diff`, then deploy with
`ansible-playbook deploy/site.yml --ask-become-pass`; use `--limit` or component
tags only when the user narrows the task. XPS is the controller and deploys to
its local `andre` session, Grace's `andre` desktop, and Grace's `agent` terminal
account. Never bypass the playbook with ad-hoc copies for a managed path.

Read the installed Omarchy skill for desktop changes. Never edit packaged
`/usr/share/omarchy` files. Only the paths and blocks named by the playbook are
authoritative; machine-specific monitor/touchpad settings, credentials, and
runtime data remain local. Files under `examples/` are installed only when the
playbook explicitly names them; the directory is not a home-directory overlay.

The repository contains no credentials, real backup destination or recovery
item identifiers, device pairings, account authentication, logs, or backup and
screensaver history. Keep those local. Use the installed Codex Secrets skill for
1Password work. Preserve attribution and component licenses.

Prefer updating only the affected component. The playbook applies XPS first,
then Grace, stages complete owned trees, and removes temporary recovery trees
after verification. Plugin changes require a full `omarchy restart shell`;
Hyprland changes require `hyprctl reload` plus `hyprctl configerrors`. Avoid
closing user windows or interrupting transfers while checking behavior.
