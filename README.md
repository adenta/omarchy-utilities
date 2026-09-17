# Omarchy utilities

Shared personal desktop customizations for XPS and Grace, initially imported
from a working Omarchy 4.0.3 installation. One source repository, ordinary file
copying, and agents following [AGENTS.md](AGENTS.md). There is no installer,
machine-profile framework, deployment daemon, or automatic updater.

The normal checkout is `~/Projects/omarchy-utilities`. Edit here, test, commit and
push, then copy the changed files to both computers. Files beneath `files/` map
directly to the same relative path beneath the desktop user's home. Files beneath
`system/` map beneath `/` and require the established administrator connection.
Inspect diffs and save private rollback copies first. Never copy `examples/`
directly over existing configuration.

## Components

| Component | Source / installed location | Dependencies and checks |
| --- | --- | --- |
| Bar and panels | `files/.config/omarchy/plugins/andre.{bar,clock,system-pulse,backups,credits,background,idle,agents}` | Omarchy shell/Quickshell; htop for System Pulse; open each panel and run its existing tests. |
| Battery history panel (XPS only) | `files/.config/omarchy/plugins/andre.power` | UPower; preserve history/aggregation, run `node tests/history.test.cjs`, `node tests/aggregation.test.cjs`, and `node tests/run.cjs` inside the plugin. Grace keeps stock power. |
| Lock-screen observation (XPS only) | `files/.config/omarchy/plugins/andre.lock` | Facelock via dedicated observation PAM; icons, local logs and upstream baseline checking. See [setup and boundaries](docs/face-observe.md). |
| Shared window and keyboard behavior | `files/.config/hypr/omarchy-utilities.lua` | Load once at the end of personal `hyprland.lua`; reload and check config errors. |
| Themes and night light | `files/.local/share/darkman/`, `files/.config/omarchy/hooks/`, the two orb wallpapers, and `hyprsunset.conf` | Darkman, Omarchy, Hyprsunset; check light/dark transitions and night-light temperature. Darkman's location stays local. |
| Pokémon screensaver | `files/.local/bin/omarchy-pokemon-*`, `files/.local/share/omarchy-pokemon-screensaver/`, `files/.config/omarchy/screensaver/`, `andre.idle` | Omarchy renderer/ttfx and a supported terminal; verify launch, exit, and artwork cycling. Keep rotation state local. |
| Terminal preferences | `files/.config/{alacritty,foot,ghostty,kitty}/` | Install preferences only for the intended terminals. Preserve generated theme files and machine-specific terminal selection. |
| Codex terminal shortcuts | `files/.config/tmux/codex.conf`, `files/.local/libexec/codex-terminal-clipboard` | Existing Omarchy tmux config, tmux, wl-clipboard; merge the bash startup fragment below. |
| Remote Codex terminals (Grace agent account) | [Account-specific files and instructions](examples/remote-codex-terminal/README.md) | tmux 3.7 and Perl; automatic startup, remote clipboard, scrolling, and disconnect cleanup. Keep separate from Andre’s desktop config. |
| Home backups | `files/.local/bin/omarchy-backup`, `files/.local/lib/omarchy-backup/`, three user systemd units | Restic, jq, curl, libsecret, util-linux, libnotify; run `bash tests/backup-policy.sh`, first backup, repository check, and sample restore. See [backup setup](docs/backups.md). |
| Performance recording | `system/etc/default/atop` and three systemd drop-ins | Atop; 600-second samples, seven generations; verify current log and enabled recorder/rotation units. |
| Dictation integration | `files/.config/voxtype-deepgram/`, user service, and `files/.local/libexec/voxtype-deepgram-daemon` | Custom [VoxType](https://github.com/adenta/voxtype) build, desktop integration, keyring; verify Insert toggle, buffered paste, clipboard restoration, and destination protection. |
| LocalSend background receiver | `files/.config/autostart/localsend_app.desktop` and the local minimize-to-tray preference | LocalSend; start hidden after desktop login, keep listening when its window closes, and verify port 53317 from the other machine. |
| Default file-dialog folder | `examples/file-chooser.dconf` and `files/.config/systemd/user/xdg-desktop-portal-gtk.service.d/` | GTK 3/4, dconf, GTK desktop portal; new portal dialogs without an app-specified folder begin at Downloads. |

### Codex weekly pace panel

The shared `andre.agents` plugin replaces stock `omarchy.agents`. Its weekly
Codex meter marks the allowance for the exact elapsed portion of the week,
labels pace, and turns orange/red when usage exceeds that allowance. The header
indicates installed stock-widget changes that need review; it does not fetch or
install updates. See the plugin's `MAINTENANCE.md` for baseline handling.

Deploy only this plugin's committed files, preserving account data in each
machine's local state directory. Run `omarchy-shell shell rescanPlugins`, then
`omarchy plugin enable andre.agents` to replace the existing stock slot while
preserving the rest of the local bar configuration. Saved changes normally
hot-reload; restart the shell only if the old code remains cached. Verify the
plugin, pace tests, and stock baseline on both machines. Different stock Omarchy
versions may legitimately show the review icon on only one machine.

## Personal integration

- Merge `examples/shell.json` into the local shell configuration. Preserve the
  laptop's `andre.power` panel on XPS; Grace uses stock `omarchy.power`. Reference
  `adenta.codex-ops` only where Codex Ops has installed it; do not copy its code.
- Merge the screensaver entry from `examples/omarchy-menu.jsonc` into the existing
  menu. Preserve unrelated entries. `andre.idle` and `andre.background` replace
  the corresponding stock services; keep the matching disabled-plugin entries.
- Add `require("hypr.omarchy-utilities")` once to the end of `hyprland.lua`.
  Remove previous copies of the same shared rules/bindings to avoid duplicate
  callbacks. Keep local monitor, touchpad, Slack, and Touch Divider settings.
- The shared rules place Codex on workspace 1, open Files centered at 875×600,
  always float LocalSend at 875×600, and float a new Chromium window at that size
  only when another mapped, visible window occupies its workspace. Empty
  workspaces retain Chromium's normal tiling. OpenBubbles Dev floats at its
  saved window size. Caps Lock works normally;
  Super+Ctrl+Space opens emoji, Alt+Shift+4 captures a screenshot, and Super+A
  forwards select-all.
- To start Codex at login, add `o.launch_on_start("chatgpt")` to local autostart
  if absent. Do not copy XPS's entire autostart file.
- Enable Darkman's existing user service. Keep its local latitude/longitude and
  portal preferences in `~/.config/darkman/config.yaml`. The shared hooks select
  Catppuccin Latte by day, Tokyo Night at night, and matching orb backgrounds.

Before Omarchy's interactive shell setup in `.bashrc`, merge:

```bash
if [[ -z ${TMUX-} && -t 0 && -t 1 && -r /proc/$PPID/comm &&
      -r "$HOME/.config/tmux/codex.conf" &&
      -x "$HOME/.local/libexec/codex-terminal-clipboard" ]] &&
   [[ $(</proc/$PPID/comm) == ChatGPT ]] && command -v tmux >/dev/null; then
  exec tmux -L codex-app-v2 -f "$HOME/.config/tmux/codex.conf" new-session
fi
```

This is an optional personal terminal integration, not a modification of Codex
or Codex Ops. Verify copy, paste, select-all, and Ctrl+C interruption.

### LocalSend and file dialogs

Apply these preferences on both XPS and Grace.

- Install the LocalSend desktop entry in `~/.config/autostart/`. Inspect and
  back up any existing LocalSend entries first; keep only one enabled entry.
  Older installations may use `org.localsend.localsend_app.desktop` instead.
  Run `systemctl --user daemon-reload` after copying. Omarchy's existing XDG
  autostart target runs it at desktop login; no extra service is needed.
- Enable **Minimize to tray** in LocalSend. The local preference is
  `flutter.ls_minimize_to_tray=true` in
  `~/.local/share/org.localsend.localsend_app/shared_preferences.json`.
  If editing it directly, first confirm no transfer is active and quit the app,
  back up the file privately, change only that key, then reopen LocalSend.
  Never commit or copy the whole preferences file: it contains device identity,
  security material, and receive history. The app's **Autostart** and
  **Autostart (hidden)** switches should both be enabled. See
  [upstream startup behavior](https://github.com/localsend/localsend/blob/v1.18.2/app/lib/util/native/autostart_helper.dart).
- Verify a hidden launch listens on TCP/UDP 53317 with no mapped window. Open
  LocalSend, check its centered 875×600 window, then close it and confirm the
  receiver still answers from the other computer. No reboot is required to
  test the entry's command; the next login exercises session startup itself.
- For the picker, save the current `startup-mode` values from both
  `org.gtk.Settings.FileChooser` and `org.gtk.gtk4.Settings.FileChooser`.
  Merge only the two settings with `dconf load / < examples/file-chooser.dconf`.
  This preserves other chooser preferences, including sorting and hidden files.
- Install the GTK portal drop-in, ensure `~/Downloads` exists, and run
  `systemctl --user daemon-reload`. Restart
  `xdg-desktop-portal-gtk.service` when no file dialog is open if its working
  directory changed. Both chooser schemas must report `startup-mode='cwd'`;
  the portal process must have `~/Downloads` as its working directory.
  Open a fresh portal chooser without a requested folder to verify Downloads.
  An application can still explicitly choose a different folder; non-portal
  GTK dialogs start in that application's own working directory.

### Dictation shortcuts

Grace dictation is deferred until its microphone is available. Its app, service,
settings, and build were removed from active locations; keep the source here for
that future setup. XPS dictation remains installed. The Deepgram credential on
Grace remains local for the shared credits panel.

When resuming Grace setup, use Hyprland shortcuts without raw input-device access. Add
`require("hypr.voxtype-shortcuts")` once to local `hyprland.lua`, and copy
`examples/voxtype-compositor.conf` to
`~/.config/systemd/user/voxtype-deepgram.service.d/shortcuts.conf`.
Reload Hyprland, reload user systemd units, and enable/start
`voxtype-deepgram.service`. Insert toggles recording; Escape cancels and also
reaches the focused application. Shift+Insert remains available for pasting.
XPS keeps its existing evdev hotkeys; do not load this optional module there
unless intentionally switching methods. The module's source is copied to both
machines, while the opt-in and service override are local integration settings.

## Checking a change

Run the relevant existing panel tests:

```sh
node files/.config/omarchy/plugins/andre.system-pulse/tests/run.js
node files/.config/omarchy/plugins/andre.backups/tests/run.js
node files/.config/omarchy/plugins/andre.credits/tests/run.js
node files/.config/omarchy/plugins/andre.agents/tests/run.cjs
bash tests/backup-policy.sh
bash tests/backup-size.sh
node tests/pokemon-screensaver.js
node tools/normalize-pokemon.mjs --check
node tests/pokemon-centering.js
node tests/pokemon-effects.js
```

Use `omarchy plugin validate PATH` for changed plugins, `bash -n` for changed
shell files, and inspect the affected feature in the live desktop after copying.
For window changes, run `hyprctl reload` and `hyprctl configerrors`, then check
Chromium on both empty and occupied workspaces and LocalSend. Save and restore
the user's original workspace; close only test windows created by the task.

## Kept separate

- [Codex Ops](https://github.com/adenta/codex-ops): owns its runtime, services,
  credentials integration, and panel. This repository only references its panel.
- [VoxType](https://github.com/adenta/voxtype): owns the program. Initial deployed
  source is commit `f3ae3154ab0f5f106c01faa29e4a6bfa1aa38dbe`; the settings and
  service wrapper here are the personal integration. Its executable lives at
  `~/.local/lib/voxtype-builds/COMMIT/voxtype`, linked as `~/.local/bin/voxtype-deepgram`.
  Keep the key in Secret Service under `application=voxtype, provider=deepgram`.
- Deck Builder Lite stays in its existing repository; it is not deployed here.
- AirPods tools, Touch Divider, Slack launchers/rules, Snapmaker Orca, and
  EasyEffects are not transferred. Existing XPS installations remain local.
- Steam can be installed normally; account sign-in and game installation belong
  to the user. Development tools are installed through managed toolchains as needed.

See [NOTICE.md](NOTICE.md) for third-party origins and licenses.
