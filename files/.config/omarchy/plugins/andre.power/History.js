function parse(raw, kind) {
  var payload = JSON.parse(raw)
  if (payload.type !== "a(udu)" || !Array.isArray(payload.data) || !Array.isArray(payload.data[0]))
    throw new Error("Invalid UPower history response")
  return payload.data[0].filter(function(row) {
    return Array.isArray(row) && (row.length === 3 || row.length === 4) &&
      typeof row[0] === "number" && isFinite(row[0]) && row[0] > 0 &&
      typeof row[1] === "number" && isFinite(row[1]) && row[1] >= 0 && (kind === "rate" || row[1] <= 100) &&
      Number.isInteger(row[2]) && row[2] >= 0 && row[2] <= 6
  }).map(function(row) {
    return { time: row[0], value: row[1], state: row[2], breakBefore: row[3] === true }
  }).sort(function(a, b) { return a.time - b.time })
}

// Only discharge is system draw. Charging rate measures energy entering the
// battery, and must not be shown as the laptop's consumption. Also break across
// sleep/missing samples rather than drawing a fictitious plateau.
function powerSegments(points, start, end, interval) {
  var maxGap = 2 * (interval || 60)
  var result = [], segment = [], previous = null
  points.forEach(function(point) {
    if (point.breakBefore || point.state !== 2 || (previous && point.time - previous.time > maxGap)) {
      if (segment.length) result.push(segment)
      segment = []
    }
    if (point.state === 2 && point.time >= start && point.time <= end) segment.push(point)
    previous = point
  })
  if (segment.length) result.push(segment)
  return result
}

function powerCeiling(groups) {
  var maximum = 0
  groups.forEach(function(group) {
    group.forEach(function(point) { maximum = Math.max(maximum, point.value) })
  })
  return Math.max(10, Math.ceil(maximum / 10) * 10)
}

function nearPower(groups, time, interval) {
  var point = nearest(groups, time)
  return point && Math.abs(point.time - time) <= (interval || 60) ? point : null
}

function segments(points, start, end) {
  var result = [], segment = []
  points.forEach(function(point) {
    if (point.state === 0) {
      if (segment.length) result.push(segment)
      segment = []
    } else if (point.time >= start && point.time <= end) {
      segment.push(point)
    }
  })
  if (segment.length) result.push(segment)
  return result
}

function nearest(groups, time) {
  var best = null
  groups.forEach(function(group) {
    group.forEach(function(point) {
      if (!best || Math.abs(point.time - time) < Math.abs(best.time - time)) best = point
    })
  })
  return best
}

function stateLabel(state) {
  return ["Unknown", "Charging", "Discharging", "Empty", "Fully charged", "Pending charge", "Pending discharge"][state] || "Unknown"
}
