.pragma library

function parseUsd(raw) {
  var text = String(raw || "").trim()
  if (text === "") return null
  var value = Number(text)
  if (!isFinite(value) || value < 0) return null
  return value
}

function selection(value) {
  return value === "deepgram" || value === "openrouter" ? value : ""
}

function toggleSelection(current, provider) {
  return current === provider ? "" : selection(provider)
}

function empty() { return {amount: null, unlimited: false, refreshedAt: 0, error: ""} }

function update(previous, raw, code, now, allowUnlimited) {
  var unlimited = allowUnlimited && String(raw).trim() === "unlimited"
  var amount = parseUsd(raw)
  if (code === 0 && (unlimited || amount !== null))
    return {amount: amount, unlimited: unlimited, refreshedAt: now, error: ""}
  return {amount: previous.amount, unlimited: previous.unlimited,
    refreshedAt: previous.refreshedAt, error: code === 3 ? "Key not found or keyring unavailable" : "Refresh failed"}
}

function display(state, placeholder) {
  return state.unlimited ? "No key limit" : state.amount === null ? placeholder : "$" + state.amount.toFixed(2)
}
