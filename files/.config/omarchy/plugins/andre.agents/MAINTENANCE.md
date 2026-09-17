# Custom Agents widget

Cloned from `omarchy.agents` on 2026-09-17. Packaged source:
`/usr/share/omarchy/shell/plugins/agents`.

Changes: exact-time weekly Codex pace marker and status, orange when up to five
percentage points above pace and red beyond that, plus a header indicator when
the installed stock widget differs from the reviewed baseline.

`Pace.js` owns the arithmetic; `Panel.qml` renders it. Existing refresh behavior
is retained (30-second countdown while open; usage refresh on opening).
`check-upstream` compares the sorted stock file names and SHA-256 hashes with
`upstream.sha256`. It runs when opening the panel. Failure hides the indicator.
It checks installed package changes, not unreleased online changes. Custom
files are never included in this comparison.

After an upstream change, review the stock files and merge applicable changes
into this clone, preserving custom behavior. Test and visually verify first.
Only then explicitly update the baseline with:

```bash
(cd /usr/share/omarchy/shell/plugins/agents && find . -type f -print0 | LC_ALL=C sort -z | xargs -0 -r sha256sum | sha256sum | cut -d ' ' -f 1) > ~/.config/omarchy/plugins/andre.agents/upstream.sha256
```

Never automatically advance the baseline merely to hide the icon. If code
hot-reloading retains the old widget, use `omarchy restart shell`.
To return to stock, use `omarchy plugin enable omarchy.agents`.
