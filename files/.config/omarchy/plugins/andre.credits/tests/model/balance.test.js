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
