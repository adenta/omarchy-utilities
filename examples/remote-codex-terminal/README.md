# Remote Codex terminals

This is the remote terminal integration for Grace's **agent** account. It is
separate from the desktop-user configuration in `files/.config/tmux/` and from
Codex Ops. Do not install these files in Andre's desktop account. Love retains
its existing working tmux 3.4 integration; this variant targets Grace's tmux 3.7.

Each new Codex terminal gets a fresh tmux server/session with 100,000 lines of
history, a hidden status bar, and cleanup after its last client disconnects.
Ctrl+A selects the transcript without copying; Ctrl+C copies a selection or
interrupts the foreground command; Ctrl+V pastes the connecting computer's
clipboard. The wheel scrolls retained output. Drag selection stays highlighted
until copied or cancelled; Shift+drag retains the terminal's native selection.
Scrolling moves by text rows, as in the existing Love setup.

## Files and deployment

Dependencies: Bash, tmux 3.7 with `get-clipboard request`, Perl and its core
modules, and Codex terminal OSC 52 clipboard support. No new service or package
is required on Grace.

- The repository playbook copies `codex.conf`, `codex-paste.pl`, and
  `codex-startup.bash` into the agent account's `~/.config/tmux/`, preserving
  the existing stock `tmux.conf`.
- It manages the following line in the account's active Bash login file. Grace
  uses `~/.bash_profile`; a `~/.profile` hook would be ignored there.

  `[[ -r "$HOME/.config/tmux/codex-startup.bash" ]] && source "$HOME/.config/tmux/codex-startup.bash"`

- The hook runs only for an interactive terminal whose direct parent is a
  Codex Ops bundle's `codex app-server`. Normal SSH shells, commands, and
  existing tmux shells continue normally. It preserves the working directory.
  The executable check only recognizes the parent; it does not modify Codex
  Ops files or services. Reassess it if the installed executable path changes.
- Record the deployed commit in an adjacent local source note. Open a **new**
  terminal tab to load the settings; existing sessions are left running.

## Clipboard behavior

The on-demand Perl helper reads a reply inside a temporary background tmux
window, keeps its bytes in memory, then uses bracketed paste into the original
pane. It accepts only the terminal's sole connected client. It temporarily
enables tmux's application clipboard query support while waiting, and restores
the previous options after success or failure. There is no access to Andre's
local desktop keyring or Wayland session.

Grace's tmux 3.7 uses an OSC 52 request from the receiving pane with
`get-clipboard request`. Love's older helper used `refresh-client -l PANE`;
copying that helper unchanged does not work on Grace. See the
[tmux clipboard request implementation](https://github.com/tmux/tmux/blob/master/input.c).

A missing or invalid reply pastes nothing, clears the busy state, and disables
further requests in that terminal until reopened. This avoids reusing a stale
buffer or late response. Ctrl+Shift+V remains available. Empty replies can take
the same timeout path, depending on tmux's handling.

## Verification

Run `node tests/remote-terminal.cjs` as the target account against its installed
configuration. It uses isolated PTYs and synthetic clipboard replies, checking
selection, copy, Unicode/multiline paste, interruption, timeout/late replies,
ordinary shell behavior, and cleanup. Run
`node tests/remote-terminal-scroll.cjs local "$HOME/.config/tmux/codex.conf"`
for wheel/drag checks. Tests close only their own sessions.

Also verify a fresh terminal created by the installed Codex app-server starts
tmux automatically and cleans up on close. In the actual desktop app, open a
new Grace terminal with the panel's **+** button and try Ctrl+A → Ctrl+C and
Ctrl+V with harmless text. Physical key handling and desktop clipboard access
are distinct from the synthetic protocol checks.

Rollback restores only the saved login-file changes and these added files.
Preserve later unrelated changes; existing terminal sessions are not restarted.
