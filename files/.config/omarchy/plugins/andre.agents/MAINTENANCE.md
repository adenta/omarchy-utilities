# Custom Agents widget

Cloned from `omarchy.agents` on 2026-09-17. Packaged source:
`/usr/share/omarchy/shell/plugins/agents`.

Changes: exact-time weekly Codex pace marker and status, orange when up to five
percentage points above pace and red beyond that, plus a header indicator when
the installed stock widget differs from the reviewed baseline.

`Pace.js` owns the arithmetic; `Panel.qml` renders it. The bar uses the font's
angry robot when Codex is above weekly pace: orange up to five percentage points
above target, red beyond that or at the limit. Bar colors adapt to the bar's
background; panel colors adapt to the popup. The warning remains visible when
another provider is selected. On-track or unavailable pace uses the original
excited robot, retaining existing low-balance and near-limit color alarms.
The 30-second clock runs while the widget is visible, including with the panel
closed, so the expression can recover as time passes. Usage refresh on opening
is retained.
`check-upstream` compares the sorted stock file names and SHA-256 hashes with
`upstream.sha256`. It runs when opening the panel. A failed check, abnormal exit, or unrecognized output shows an unknown-status
indicator and explanation. While checking, the panel shows a checking message;
reopening retries asynchronously without retaining a stale successful result.
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
