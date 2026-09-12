.pragma library

function parseUsd(raw) {
  var text = String(raw || "").trim()
  if (text === "") return null
  var value = Number(text)
  if (!isFinite(value) || value < 0) return null
  return value
}
