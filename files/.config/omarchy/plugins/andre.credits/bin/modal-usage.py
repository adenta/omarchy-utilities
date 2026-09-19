import json
import os
import subprocess
import sys

try:
    entry = subprocess.run(
        ["secret-tool", "lookup", "application", "omarchy-credits", "provider", "modal"],
        capture_output=True, text=True, timeout=10, check=True,
    )
    credential = json.loads(entry.stdout)
    token_id, token_secret = credential["token_id"], credential["token_secret"]
    if not token_id.startswith("ak-") or not token_secret.startswith("as-"):
        raise ValueError("Invalid credential")
except Exception:
    sys.exit(3)

os.environ["MODAL_TOKEN_ID"] = token_id
os.environ["MODAL_TOKEN_SECRET"] = token_secret
try:
    import modal
    summary = modal.Workspace.from_context().billing.summary()
    print(json.dumps({"amount": str(summary.metered_cost), "cycle": summary.start.strftime("%Y-%m")}))
except Exception:
    sys.exit(1)
