.pragma library
function isBusy(state) { return ["backing-up", "pruning", "checking", "restoring"].indexOf(state.phase) >= 0 }
function severity(state, now) {
 if (state.lastError || state.phase === "failed") return "error"
 var since = state.lastSuccess || state.createdAt || now
 if (now - since >= 172800) return "warning"
 if (isBusy(state) && now - (state.updatedAt || 0) <= 120) return "active"
 return "neutral"
}
function description(state, now) {
 if (isBusy(state) && now - (state.updatedAt || 0) > 120) return "Waiting for the backup service to resume"
 var phases = {"backing-up":"Backing up", "pruning":"Cleaning up old backups", "checking":"Checking backup integrity", "restoring":"Restoring files", "ready":"Up to date", "unconfigured":"Not configured", "failed":"Needs attention", "waiting":"Waiting"}
 return state.reason || phases[state.phase] || "Backup status unavailable"
}
function dateLabel(seconds) { return seconds ? new Date(seconds * 1000).toLocaleString() : "Not yet" }
function size(bytes) { return Number.isFinite(Number(bytes)) ? (Number(bytes)/1073741824).toFixed(1)+" GiB" : "Unavailable" }
