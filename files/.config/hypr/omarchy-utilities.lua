-- Source: https://github.com/adenta/omarchy-utilities (read AGENTS.md).
-- Shared by XPS and Grace. Hardware and application-specific local rules stay local.

hl.config({ input = { kb_options = "" } })

o.bind("ALT + SHIFT + 4", "Screenshot", "omarchy-capture-screenshot")
hl.unbind("SUPER + CTRL + SPACE")
o.bind("SUPER + CTRL + SPACE", "Emojis", "omarchy-shell shell toggle omarchy.emojis")
o.bind("SUPER + A", "Universal select all", function()
  hl.dispatch(hl.dsp.send_key_state({ mods = "CTRL", key = "A", state = "down" }))
  hl.timer(function()
    hl.dispatch(hl.dsp.send_key_state({ mods = "CTRL", key = "A", state = "up" }))
  end, { timeout = 50, type = "oneshot" })
end)

o.window("^chatgpt$", { workspace = "1" })
o.window("^org[.]gnome[.]Nautilus$", {
  float = true, center = true, size = { 875, 600 },
})
o.window("^org[.]localsend[.]localsend_app$", {
  float = true, center = true, size = { 875, 600 },
})

-- Chromium floats only when another mapped, visible window occupies its workspace.
hl.on("window.open", function(window)
  if not window or window.class ~= "chromium" or not window.workspace then return end
  for _, other in ipairs(hl.get_workspace_windows(window.workspace)) do
    if other.address ~= window.address and other.mapped and not other.hidden then
      hl.dispatch(hl.dsp.window.float({ window = window, action = "set" }))
      hl.dispatch(hl.dsp.window.resize({ window = window, x = 875, y = 600, relative = false }))
      hl.dispatch(hl.dsp.window.center({ window = window }))
      return
    end
  end
end)
