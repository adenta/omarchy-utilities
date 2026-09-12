#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/../files/.local/lib/omarchy-backup/policy.sh"
fixture=$(mktemp -d)
trap 'rm -rf -- "$fixture"' EXIT
reset() { rm -rf -- "$fixture/power"; mkdir "$fixture/power"; }
battery() {
  local name=$1 scope=$2 capacity=$3
  mkdir -p "$fixture/power/$name"
  printf 'Battery\n' > "$fixture/power/$name/type"
  printf '%s\n' "$scope" > "$fixture/power/$name/scope"
  printf '%s\n' "$capacity" > "$fixture/power/$name/capacity"
}
allowed() { backup_power_reason "$fixture/power" || { echo "Unexpected block: $1" >&2; exit 1; }; }
blocked() { if backup_power_reason "$fixture/power" >/dev/null; then echo "Unexpected permission: $1" >&2; exit 1; fi; }
reset; allowed 'desktop without a battery'
battery mouse Device 3; allowed 'desktop with low peripheral battery'
battery BAT0 System 80; allowed 'charged laptop with low peripheral battery'
printf '30\n' > "$fixture/power/BAT0/capacity"; blocked 'system battery at 30 percent'
mkdir "$fixture/power/AC"; printf 'Mains\n' > "$fixture/power/AC/type"; printf '1\n' > "$fixture/power/AC/online"
allowed 'low system battery on AC'
printf '0\n' > "$fixture/power/AC/online"; blocked 'unplugged low system battery'
printf 'invalid\n' > "$fixture/power/BAT0/capacity"; blocked 'unknown system capacity'
reset; battery BAT0 System 70; battery BAT1 System 20; blocked 'second system battery is low'
printf '0\n' > "$fixture/power/BAT1/present"; allowed 'absent second battery'
rm "$fixture/power/BAT0/scope"; allowed 'system battery without optional scope field'
if backup_power_reason "$fixture/missing" >/dev/null; then echo 'Missing power tree should fail' >&2; exit 1; fi
backup_due 86400 0
if backup_due 86399 1; then exit 1; fi
backup_retry_due 50 50
if backup_retry_due 49 50; then exit 1; fi
echo 'Backup power, schedule, and retry policy checks passed.'
