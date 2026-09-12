.pragma library
function validNumber(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 }
function fraction(progress) {
 if (!progress || !validNumber(progress.total_bytes) || progress.total_bytes <= 0 || !validNumber(progress.bytes_done)) return null
 var value = validNumber(progress.percent_done) ? progress.percent_done :
  validNumber(progress.bytes_done) ? progress.bytes_done / progress.total_bytes : null
 return value === null ? null : Math.max(0, Math.min(1, value))
}
function label(progress) {
 var value = fraction(progress)
 if (value === null) return "Working…"
 return (progress.bytes_done / 1073741824).toFixed(1) + " / " + (progress.total_bytes / 1073741824).toFixed(1) + " GiB"
}
function remaining(progress, updatedAt, now) {
 if (!progress || !validNumber(progress.seconds_remaining) || !(progress.seconds_elapsed >= 30) || fraction(progress) === null) return null
 if (!validNumber(updatedAt) || now - updatedAt > 120) return null
 return Math.max(0, Math.ceil(updatedAt + progress.seconds_remaining - now))
}
function duration(seconds) {
 if (seconds < 60) return "under a minute"
 var minutes = Math.ceil(seconds / 60)
 return minutes < 60 ? minutes + " min" : Math.floor(minutes / 60) + " hr" + (minutes % 60 ? " " + minutes % 60 + " min" : "")
}
function estimate(progress, updatedAt, now) {
 var seconds = remaining(progress, updatedAt, now)
 if (seconds === null) return "Estimating…"
 if (seconds === 0) return fraction(progress) >= 1 ? "Finishing…" : "Updating estimate…"
 var finish = new Date((now + seconds) * 1000).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"})
 return "Around " + finish + " · " + duration(seconds) + " left"
}
