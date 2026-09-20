# Credits

Shows Deepgram and Modal USD figures. Click a row's stock Omarchy toggle switch to
show that service in the bar; click again to return to icon-only. No service is
selected initially. Selection is saved locally in `~/.config/omarchy/credits.ini`.
An obsolete saved provider selection is cleared to icon-only.
Up/Down moves between rows and Refresh; Enter/Space activates the current control.

Balances refresh on startup, hourly, and with Refresh. Errors preserve the last
successful balance and mark it stale. Missing keys show an unavailable row.

Credentials are read from the desktop Secret Service keyring:

- Deepgram: `application=voxtype`, `provider=deepgram`.
- Modal: `application=omarchy-credits`, `provider=modal`; the secret is a JSON object with `token_id` (`ak-…`) and `token_secret` (`as-…`).

The deprecated Codex Ops credential bundle is not used. Credentials and selection
settings are local to each machine and are not included in deployments.

Run model checks with `node tests/run.js`; helpers require Bash, secret-tool,
curl, and jq. Exit code 3 indicates a missing or inaccessible keyring credential.

Modal additionally requires Mise-managed uv 0.12.15 and its pinned Modal SDK 1.5.5 (resolved by uv). The helper returns only the current billing month and metered USD cost, never credentials. It times out after 55 seconds. Monthly usage is not remaining credits or an all-time total. A failed refresh preserves only a value from the same UTC month.
