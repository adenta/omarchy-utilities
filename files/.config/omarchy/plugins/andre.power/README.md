# Battery charge and power history

User-owned clone of Omarchy's power panel. The charge graph sits below the
battery information and immediately above the power-profile settings.

- Ranges: 1 hour, 24 hours (default), 7 days. Keys 1/2/3 select the range.
- Charge is the foreground line against the left percentage axis. Battery draw
  appears in all three views, in amber against the right watts axis.
- The hour view retains its existing detail. Both series are averaged into fixed 5-minute buckets for 24 hours and
  30-minute buckets for 7 days. Power averages use discharging samples only;
  interrupted buckets break the line. Empty buckets remain gaps. History is
  streamed to jq rather than passed as arguments.
- Hover for battery draw and the closest recorded charge sample with its time.
- Power is shown only while discharging: charging watts measure battery input,
  not laptop consumption. Unknown states and gaps over twice the view's sample
  interval break the power line (2, 10, or 60 minutes). Hover shows no reading
  farther than one interval from a sample (1, 5, or 30 minutes).
- Uses existing UPower history over the system bus. No new recorder or database.
- Reads on open/range selection and every 30 seconds while open; closing stops
  the timer and any in-flight helper. A failed refresh retains the last graph.
- `bin/battery-history` discovers a present system battery with history, excluding
  peripheral batteries. It uses existing bash, busctl and jq installations.
- UPower controls retention and sampling. Unknown-state markers break the line;
  straight lines between recorded points are interpolation, not extra samples.

Validation: `node tests/history.test.cjs` and `omarchy plugin validate .`.
The implementation was also tested offscreen for open/close polling, failed
refresh retention and reopening, and visually in the live panel in all ranges.

Original bar configuration backup:
`~/.config/omarchy/shell.json.bak.battery-history-20260907`.
To roll back just this feature, restore the battery entry in shell.json from
`andre.power` to `omarchy.power`, preserving other current settings, then restart
the shell if necessary. Packaged Omarchy files were not modified.
