#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
fixture=$(mktemp -d)
trap 'rm -rf -- "$fixture"' EXIT
export OMARCHY_BACKUP_CONFIG_DIR="$fixture/config"
export OMARCHY_BACKUP_STATE_DIR="$fixture/state"
export OMARCHY_BACKUP_LIB_DIR="$repo/files/.local/lib/omarchy-backup"
mkdir -p "$OMARCHY_BACKUP_CONFIG_DIR"
touch "$OMARCHY_BACKUP_CONFIG_DIR/recovery.json"
source "$repo/files/.local/bin/omarchy-backup"

expect_size() {
 local expected=$1 input=$2 actual
 actual=$(printf '%s\n' "$input" | jq -sf "$lib_dir/summary-size.jq")
 [[ $actual == "$expected" ]] || { echo "Expected $expected, got $actual" >&2; exit 1; }
}
expect_size 2482718830 '{"message_type":"summary","total_bytes_processed":2482718830,"data_added":100}'
expect_size 0 '{"message_type":"summary","total_bytes_processed":0}'
expect_size null '{"message_type":"status","total_bytes":123}'
for value in null '"123"' -1 1.5 9007199254740992; do
 expect_size null "{\"message_type\":\"summary\",\"total_bytes_processed\":$value}"
done

# Exercise the real worker with fake external operations, never credentials or B2.
load_config() { backup_source="$fixture/home"; }
credentials() { :; }
backup_power_reason() { return 0; }
notify_issue() { :; }
curl() { :; }
timeout() { shift; "$@"; }
pacman() { :; }
restic() {
 if [[ $1 == tag ]]; then [[ $scenario != tag-failed ]]; return; fi
 printf '[{"id":"bbbbbbbb","time":"2026-01-01T00:00:00Z","paths":[]}]\n'
}
run_restic() {
 local operation=$1
 update '.phase=$phase | .progress={}' --arg phase "$operation"
 [[ $operation == backing-up ]] || return 0
 runlog="$state_dir/logs/test.jsonl"; errlog="$state_dir/logs/test.log"
 printf '{"message_type":"summary","snapshot_id":"aaaaaaaa","total_bytes_processed":2482718830,"data_added":100}\n' > "$runlog"
 case $scenario in
  missing-size) printf '{"message_type":"summary","snapshot_id":"aaaaaaaa"}\n' > "$runlog" ;;
  failed) return 1 ;;
  cancelled) update '.phase="waiting" | .reason="Cancelled"'; return 130 ;;
 esac
}
for scenario in success failed cancelled tag-failed missing-size maintenance; do
 printf '{"phase":"ready","createdAt":1,"lastSuccess":1,"lastMaintenance":%s,"lastBackupBytes":123,"snapshotId":"old"}\n' "$(now)" > "$state"
 result=0
 if [[ $scenario == maintenance ]]; then
  update '.lastSuccess=$now | .lastMaintenance=0' --argjson now "$(now)"
  (worker) || result=$?
 else
  (worker --manual) || result=$?
 fi
 case $scenario in
  success) [[ $result == 0 ]]; jq -e '.lastBackupBytes == 2482718830 and .snapshotId == "bbbbbbbb"' "$state" >/dev/null ;;
  missing-size) [[ $result == 0 ]]; jq -e '.lastBackupBytes == null and .snapshotId == "bbbbbbbb"' "$state" >/dev/null ;;
  maintenance) [[ $result == 0 ]]; jq -e '.lastBackupBytes == 123' "$state" >/dev/null ;;
  *) [[ $result != 0 ]]; jq -e '.lastBackupBytes == 123 and .snapshotId == "old"' "$state" >/dev/null ;;
 esac
done
echo 'Backup size extraction, finalization, failure, cancellation, and maintenance checks passed.'
