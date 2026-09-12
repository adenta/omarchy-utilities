const { load, test, eq } = require("../harness.js")
const Format = load("Format.js")

test("percent preserves the existing three-digit display", () => {
  eq(Format.percent(5), "005%")
  eq(Format.percent(34.4), "034%")
  eq(Format.percent(99), "099%")
  eq(Format.percent(99.6), "100%")
})

test("compactPercent removes padding for the top bar only", () => {
  eq(Format.compactPercent(5), "5%")
  eq(Format.compactPercent(34.4), "34%")
  eq(Format.compactPercent(99.6), "100%")
})

test("percent says so when there is nothing to say yet", () => {
  eq(Format.percent(null), "--")
})

test("gigabytes keeps one decimal", () => {
  eq(Format.gigabytes(8998204), "8.6G")
  eq(Format.gigabytes(31965652), "30.5G")
})

test("gigabytes is empty rather than wrong when there is no reading", () => {
  eq(Format.gigabytes(null), "")
})

test("storageGigabytes rounds up like df's human-readable output", () => {
  eq(Format.storageGigabytes(66672963584), "63G")
  eq(Format.storageGigabytes(509943480320), "475G")
})

test("usd shows a two-decimal Deepgram balance", () => {
  eq(Format.usd(199.58207436), "$199.58")
  eq(Format.usd(null), "$--")
})

test("barReading shows CPU and RAM only", () => {
  eq(Format.barReading(5,
                       { usedKb: 8998204, totalKb: 31965652 },
                       { usedBytes: 36953370624, totalBytes: 509943480320 },
                       199.58207436),
     "5%/8.6G")
})

test("tooltip keeps the existing CPU and memory display unchanged", () => {
  eq(Format.tooltip(34.4, { usedKb: 8998204, totalKb: 31965652 }),
     "CPU 034%  ·  MEM 8.6G / 30.5G")
})

test("tooltip degrades to the half it has", () => {
  eq(Format.tooltip(null, null), "CPU --")
})

test("uptime says days and hours once a machine has been up that long", () => {
  eq(Format.uptime(345678), "4d 00h")
  eq(Format.uptime(4 * 86400 + 2 * 3600 + 660), "4d 02h")
})

test("uptime drops to hours and minutes within a day", () => {
  eq(Format.uptime(3 * 3600 + 21 * 60), "3h 21m")
})

test("uptime drops to minutes within an hour", () => {
  eq(Format.uptime(12 * 60 + 40), "12m")
})

test("uptime is empty rather than wrong when there is no reading", () => {
  eq(Format.uptime(null), "")
})

test("memoryLabel reads as used of total", () => {
  eq(Format.memoryLabel({ usedKb: 8998204, totalKb: 31965652 }), "8.6G / 30.5G")
})

test("memoryLabel says so when there is nothing to say yet", () => {
  eq(Format.memoryLabel(null), "--")
})

test("bytes switches unit where the number stops being readable", () => {
  eq(Format.bytes(2097332224), "1.95G")
  eq(Format.bytes(609902592), "582M")
  eq(Format.bytes(940 * 1024), "940K")
})

test("bytes is empty rather than wrong when there is no reading", () => {
  eq(Format.bytes(null), "")
})

test("uptimeLabel says how long the machine has been up", () => {
  eq(Format.uptimeLabel(345678), "up 4d 00h")
})

test("uptimeLabel is empty rather than wrong when there is no reading", () => {
  eq(Format.uptimeLabel(null), "")
})
