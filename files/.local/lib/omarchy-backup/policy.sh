# Shared, side-effect-free policy functions. Power root is injectable for tests.
backup_power_reason() {
  local root=${1:-/sys/class/power_supply} dev type scope online capacity found=0 minimum=101
  [[ -d $root && -r $root ]] || { printf 'Power status unavailable'; return 1; }
  for dev in "$root"/*; do
    [[ -r "$dev/type" ]] || continue
    scope=''; [[ ! -r "$dev/scope" ]] || read -r scope < "$dev/scope"
    [[ $scope != Device ]] || continue
    read -r type < "$dev/type"
    if [[ $type != Battery && -r "$dev/online" ]]; then
      read -r online < "$dev/online"
      [[ $online == 1 ]] && return 0
    fi
  done
  for dev in "$root"/*; do
    [[ -r "$dev/type" ]] || continue
    scope=''; [[ ! -r "$dev/scope" ]] || read -r scope < "$dev/scope"
    [[ $scope != Device ]] || continue
    read -r type < "$dev/type"
    [[ $type == Battery ]] || continue
    if [[ -r "$dev/present" ]]; then
      read -r online < "$dev/present"
      [[ $online == 0 ]] && continue
    fi
    [[ -r "$dev/capacity" ]] || { printf 'Battery level unavailable'; return 1; }
    read -r capacity < "$dev/capacity"
    [[ $capacity =~ ^[0-9]+$ && $capacity -le 100 ]] || { printf 'Battery level unavailable'; return 1; }
    found=1
    (( capacity < minimum )) && minimum=$capacity
  done
  # A desktop can expose only peripheral batteries, or no power supplies at all.
  # Unknown capacity on an actual system battery still fails above.
  (( found > 0 )) || return 0
  if (( minimum <= 30 )); then printf 'Waiting for battery above 30%% or AC power'; return 1; fi
  return 0
}
backup_due() { (( $1 - $2 >= 86400 || $2 == 0 )); }
backup_retry_due() { (( $1 >= $2 )); }
