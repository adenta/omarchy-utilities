# Logical file bytes in the final summary; data_added is only this run's new data.
[.[] | select(.message_type == "summary")][-1].total_bytes_processed
| if type == "number" then
    if . >= 0 and . <= 9007199254740991 and . == floor then . else null end
  else null end
