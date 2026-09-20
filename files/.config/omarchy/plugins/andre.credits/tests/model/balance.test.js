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

test("selection starts empty and supports Deepgram and clearing", () => {
  eq(Balance.selection(undefined), "")
  eq(Balance.toggleSelection("", "deepgram"), "deepgram")
  eq(Balance.toggleSelection("deepgram", "deepgram"), "")
  eq(Balance.selection("openrouter"), "")
  eq(Balance.selection("obsolete"), "")
})
test("refresh accepts zero and preserves stale balances", () => {
  const state = Balance.update(Balance.empty(), "0", 0, 100)
  eq(Balance.display(state, "$--"), "$0.00")
  const failed = Balance.update(state, "", 3, 200)
  eq(failed.amount, 0)
  eq(failed.refreshedAt, 100)
  eq(failed.error, "Key not found or keyring unavailable")
  eq(Balance.display(Balance.empty(), "$--"), "$--")
  eq(Balance.update(state, "unlimited", 0, 300).error, "Refresh failed")
  eq(Balance.update(failed, "75", 0, 400).error, "")
})

test("Modal selection and monthly usage", () => {
  eq(Balance.toggleSelection("deepgram", "modal"), "modal")
  const now = Date.parse("2026-09-19T12:00:00Z")
  const state = Balance.updateModal(Balance.empty(), '{"amount":"0.09","cycle":"2026-09"}', 0, now)
  eq(state.amount, 0.09)
  eq(state.cycle, "2026-09")
  eq(Balance.updateModal(state, "", 1, now).amount, 0.09)
  eq(Balance.updateModal(state, "", 1, Date.parse("2026-10-01T00:00:00Z")).amount, null)
  eq(Balance.updateModal(state, '{"amount":"5","cycle":"2026-08"}', 0, now).error, "Refresh failed")
  eq(Balance.updateModal(state, '{"amount":"-5","cycle":"2026-09"}', 0, now).error, "Refresh failed")
})
