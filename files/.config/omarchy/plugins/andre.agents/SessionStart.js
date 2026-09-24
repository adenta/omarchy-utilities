// The marker is deliberately tied to the local calendar day, not to a limit
// window. A provider reset may move the live meter back to zero while the
// marker keeps showing where the day began.

function dayKey(nowMs) {
    var now = new Date(nowMs);
    return now.getFullYear() + "-"
        + String(now.getMonth() + 1).padStart(2, "0") + "-"
        + String(now.getDate()).padStart(2, "0");
}

function limitKey(providerId, limit, index) {
    var entry = limit || {};
    return String(providerId || "") + "\u001f"
        + String(entry.label || "") + "\u001f"
        + String(entry.title || "") + "\u001f"
        + String(index);
}

function capture(current, providers) {
    var previous = current && typeof current === "object" ? current : {};
    var next = {};
    var changed = false;

    for (var storedKey in previous) {
        if (Object.prototype.hasOwnProperty.call(previous, storedKey))
            next[storedKey] = previous[storedKey];
    }

    var list = providers || [];
    for (var i = 0; i < list.length; i++) {
        var provider = list[i] || {};
        if (String(provider.providerId || "") !== "codex") continue;

        var limits = provider.limits || [];
        for (var j = 0; j < limits.length; j++) {
            var percent = Number((limits[j] || {}).percent);
            if (!isFinite(percent) || percent < 0) continue;

            var key = limitKey(provider.providerId, limits[j], j);
            if (!Object.prototype.hasOwnProperty.call(next, key)) {
                next[key] = Math.max(0, Math.min(1, percent));
                changed = true;
            }
        }
    }

    return changed ? next : previous;
}

function value(current, providerId, limit, index) {
    var values = current && typeof current === "object" ? current : {};
    var key = limitKey(providerId, limit, index);
    return Object.prototype.hasOwnProperty.call(values, key) ? Number(values[key]) : -1;
}
