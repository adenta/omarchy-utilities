// Only a successful, recognized response establishes baseline status.
function classify(exitCode, normalExit, output) {
  var result = String(output || "").trim()
  return normalExit && exitCode === 0 && (result === "current" || result === "changed")
    ? result : "unknown"
}
