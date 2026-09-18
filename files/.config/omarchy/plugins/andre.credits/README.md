# Credits

Shows Deepgram and OpenRouter remaining USD balances. Click a row's stock Omarchy toggle switch to
show that service in the bar; click again to return to icon-only. No service is
selected initially. Selection is saved locally in `~/.config/omarchy/credits.ini`.
Up/Down moves between rows and Refresh; Enter/Space activates the current control.

Balances refresh on startup, hourly, and with Refresh. Errors preserve the last
successful balance and mark it stale. Missing keys show an unavailable row.
OpenRouter reports the key's remaining spending limit, not the account balance;
a key without a limit shows “No key limit”.

Credentials are read from the desktop Secret Service keyring:

- Deepgram: `application=voxtype`, `provider=deepgram`.
- OpenRouter: `application=codex-tasks`, `provider=openrouter`.

The deprecated Codex Ops credential bundle is not used. Credentials and selection
settings are local to each machine and are not included in deployments.

Run model checks with `node tests/run.js`; helpers require Bash, secret-tool,
curl, and jq. Exit code 3 indicates a missing or inaccessible keyring credential.
