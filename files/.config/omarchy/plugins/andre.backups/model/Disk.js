.pragma library

function parseUsage(raw) {
  var lines = String(raw || "").trim().split("\n")
  if (lines.length < 2) return null

  var fields = lines[lines.length - 1].trim().split(/\s+/)
  if (fields.length < 3) return null

  var usedBytes = Number(fields[0])
  var totalBytes = Number(fields[1])
  var percent = Number(String(fields[2]).replace("%", ""))
  if (!isFinite(usedBytes) || !isFinite(totalBytes) || !isFinite(percent) || totalBytes <= 0) return null

  return { usedBytes: usedBytes, totalBytes: totalBytes, percent: percent }
}

function parseAdjustedUsage(raw) {
  var fields = String(raw || "").trim().split(/\s+/)
  if (fields.length !== 3) return null

  var usedBytes = Number(fields[0])
  var totalBytes = Number(fields[1])
  var trashExclusiveBytes = Number(fields[2])
  if (!isFinite(usedBytes) || !isFinite(totalBytes) ||
      !isFinite(trashExclusiveBytes) || usedBytes < 0 ||
      totalBytes <= 0 || trashExclusiveBytes < 0) return null

  var adjustedUsedBytes = Math.max(0, usedBytes - trashExclusiveBytes)
  return {
    usedBytes: adjustedUsedBytes,
    totalBytes: totalBytes,
    percent: Math.round((adjustedUsedBytes / totalBytes) * 100),
    trashExclusiveBytes: trashExclusiveBytes
  }
}
