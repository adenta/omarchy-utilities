.pragma library

function parseUsd(raw) {
  var text = String(raw || "").trim()
  if (text === "") return null
  var value = Number(text)
  if (!isFinite(value) || value < 0) return null
  return value
}

function selection(value) {
  return (value === "deepgram" || value === "modal") ? value : ""
}

function toggleSelection(current, provider) {
  return current === provider ? "" : selection(provider)
}

function empty() { return {amount: null, refreshedAt: 0, error: ""} }

function update(previous, raw, code, now) {
  var amount = parseUsd(raw)
  if (code === 0 && amount !== null)
    return {amount: amount, refreshedAt: now, error: ""}
  return {amount: previous.amount,
    refreshedAt: previous.refreshedAt, error: code === 3 ? "Key not found or keyring unavailable" : "Refresh failed"}
}

function display(state, placeholder) {
  return state.amount === null ? placeholder : "$" + state.amount.toFixed(2)
}

function updateModal(previous, raw, code, now) {
  var cycle = new Date(now).toISOString().slice(0, 7)
  var current = previous.cycle === cycle ? previous : empty()
  try {
    var result = JSON.parse(raw)
    if (code === 0 && result.cycle === cycle && typeof result.amount === "string" && parseUsd(result.amount) !== null)
      return {amount: parseUsd(result.amount), cycle: cycle, refreshedAt: now, error: ""}
  } catch (e) {}
  var failed = update(current, "", code, now)
  failed.cycle = cycle
  return failed
}
