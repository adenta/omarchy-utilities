// No authentication authority: this state machine only describes observations.
function fresh() { return { attempted: false, sequence: 0, pending: 0, started: 0, outcome: "ready" }; }
function begin(state, now, automatic) {
  if (state.pending || (automatic && state.attempted)) return null;
  return { attempted: true, sequence: state.sequence + 1, pending: state.sequence + 1, started: now, outcome: "checking" };
}
function finish(state, id, result, now) {
  if (!state.pending || id !== state.pending) return null;
  var outcome = now - state.started > 10000 ? "timeout" : result;
  return { attempted: state.attempted, sequence: state.sequence, pending: 0, started: state.started, outcome: outcome };
}
function rearm(state) {
  return { attempted: false, sequence: state.sequence, pending: 0, started: 0, outcome: "ready" };
}
function label(outcome) {
  return ({ready: "Ready", checking: "Checking", accepted: "Face accepted", rejected: "Not accepted", timeout: "Timed out", unavailable: "Unavailable", cancelled: "Cancelled", disabled: "Disabled"})[outcome] || "Unavailable";
}
if (typeof module !== "undefined") module.exports = { fresh, begin, finish, rearm, label };
