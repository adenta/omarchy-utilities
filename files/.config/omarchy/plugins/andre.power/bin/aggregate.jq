# Fixed time buckets. Power averages contain only discharging samples.
# Mark interrupted buckets so the graph does not connect across charging/sleep.
if $interval == 0 then . else
  .data[0] |= (
    sort_by(.[0]) |
    reduce .[] as $row ({buckets: {}, previous: null};
      (($row[0] / $interval | floor) | tostring) as $key |
      (if .previous == null then false else
        ($row[0] - .previous[0] > 120 or .previous[2] != 2) end) as $gap |
      .buckets[$key] //= {time: 0, value: 0, count: 0, state: 0, gap: false, fallback: $row[0]} |
      (if $kind == "rate" then
        .buckets[$key].gap = (.buckets[$key].gap or $gap or $row[2] != 2)
      else . end) |
      (if $kind == "charge" or $row[2] == 2 then
        .buckets[$key].time += $row[0] |
        .buckets[$key].value += $row[1] |
        .buckets[$key].count += 1 |
        .buckets[$key].state = $row[2]
      else . end) |
      .previous = $row
    ) |
    [.buckets[] | if .count > 0 then
      [(.time / .count | floor), (.value / .count), .state, .gap]
    else [.fallback, 0, 0, true] end] | sort_by(.[0])
  )
end
