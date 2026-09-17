// Percentages are fractions of the full weekly allowance, not token counts.
function weekly(used, resetAt, nowMs) {
  var span = 7 * 24 * 3600 * 1000;
  var remaining = Date.parse(resetAt) - nowMs;
  if (typeof used !== "number" || !isFinite(used) || used < 0 ||
      !isFinite(remaining) || remaining <= 0 || remaining > span)
    return null;
  var target = 1 - remaining / span;
  var over = used - target;
  var level = used >= 1 ? 2 : over > 0.05 + 1e-9 ? 2 : over > 1e-9 ? 1 : 0;
  return { target: target, level: level,
    label: used >= 1 ? "Limit reached" : level === 2 ? "Well above pace" : level === 1 ? "Above pace" : "On track" };
}
