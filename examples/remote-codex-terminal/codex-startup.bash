# Source: https://github.com/adenta/omarchy-utilities/tree/main/examples/remote-codex-terminal
# Sourced by the account’s active Bash login file. Ordinary SSH shells and command execution return unchanged.
_codex_remote_terminal_start() {
  [[ $- == *i* ]] || return 0
  [[ -z ${BASH_EXECUTION_STRING-} && -z ${TMUX-} ]] || return 0
  [[ -t 0 && -t 1 ]] || return 0

  local parent_exe parent_arg app_server=0 tmux_bin session_id
  local config="$HOME/.config/tmux/codex.conf"
  [[ -r "$config" && -r /proc/$PPID/cmdline ]] || return 0
  [[ -r "$HOME/.config/tmux/codex-paste.pl" && -x /usr/bin/perl ]] || return 0
  parent_exe=$(readlink "/proc/$PPID/exe" 2>/dev/null) || return 0
  case "$parent_exe" in
    /opt/codex-ops/codex-bundles/*/bin/codex) ;;
    *) return 0 ;;
  esac
  while IFS= read -r -d '' parent_arg; do
    [[ $parent_arg == app-server ]] && app_server=1
  done < "/proc/$PPID/cmdline"
  [[ $app_server == 1 ]] || return 0
  tmux_bin=$(type -P tmux) || return 0
  [[ -x "$tmux_bin" ]] || return 0
  IFS= read -r session_id < /proc/sys/kernel/random/uuid || return 0
  [[ $session_id =~ ^[0-9a-f-]{36}$ ]] || return 0

  exec "$tmux_bin" -L "codex-remote-$session_id" -f "$config" new-session -c "$PWD"
}
_codex_remote_terminal_start
unset -f _codex_remote_terminal_start
