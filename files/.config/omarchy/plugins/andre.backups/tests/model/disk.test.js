const { load, test, eq } = require("../harness.js")
const Disk = load("Disk.js")

test("parseUsage reads the numeric df row", () => {
  eq(Disk.parseUsage(" Used 1B-blocks Capacity\n66672963584 509943480320 14%\n"), {
    usedBytes: 66672963584,
    totalBytes: 509943480320,
    percent: 14,
  })
})

test("parseUsage rejects missing and malformed rows", () => {
  eq(Disk.parseUsage(""), null)
  eq(Disk.parseUsage("Used Size Use%\nnope 100 20%\n"), null)
})

test("parseAdjustedUsage subtracts Btrfs-exclusive Trash allocation", () => {
  eq(Disk.parseAdjustedUsage("67208142848 509943480320 30254772224\n"), {
    usedBytes: 36953370624,
    totalBytes: 509943480320,
    percent: 7,
    trashExclusiveBytes: 30254772224,
  })
})

test("parseAdjustedUsage never reports negative disk use", () => {
  eq(Disk.parseAdjustedUsage("100 1000 200\n"), {
    usedBytes: 0,
    totalBytes: 1000,
    percent: 0,
    trashExclusiveBytes: 200,
  })
})

test("parseAdjustedUsage rejects partial and malformed samples", () => {
  eq(Disk.parseAdjustedUsage(""), null)
  eq(Disk.parseAdjustedUsage("100 1000"), null)
  eq(Disk.parseAdjustedUsage("nope 1000 10"), null)
})
