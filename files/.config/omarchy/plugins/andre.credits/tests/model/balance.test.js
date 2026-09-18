const { load, test, eq } = require("../harness.js")
const Balance = load("Balance.js")

test("parseUsd accepts a Deepgram balance", () => {
  eq(Balance.parseUsd("199.58207436\n"), 199.58207436)
})

test("parseUsd rejects missing, negative, and malformed balances", () => {
  eq(Balance.parseUsd(""), null)
  eq(Balance.parseUsd("-1"), null)
  eq(Balance.parseUsd("unavailable"), null)
})

test("selection starts empty and supports switching and clearing", () => {
  eq(Balance.selection(undefined), "")
  eq(Balance.toggleSelection("", "deepgram"), "deepgram")
  eq(Balance.toggleSelection("deepgram", "openrouter"), "openrouter")
  eq(Balance.toggleSelection("openrouter", "openrouter"), "")
  eq(Balance.selection("obsolete"), "")
})
test("refresh accepts zero and unlimited, and preserves stale balances", () => {
  const state = Balance.update(Balance.empty(), "0", 0, 100, false)
  eq(Balance.display(state, "$--"), "$0.00")
  const failed = Balance.update(state, "", 3, 200, false)
  eq(failed.amount, 0)
  eq(failed.refreshedAt, 100)
  eq(failed.error, "Key not found or keyring unavailable")
  eq(Balance.display(Balance.empty(), "$--"), "$--")
  const unlimited = Balance.update(state, "unlimited", 0, 300, true)
  eq(Balance.display(unlimited, "$--"), "No key limit")
  eq(Balance.update(state, "unlimited", 0, 300, false).error, "Refresh failed")
  eq(Balance.update(failed, "75", 0, 400, true).error, "")
})
