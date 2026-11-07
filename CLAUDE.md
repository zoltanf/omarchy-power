# omarchy-power: agent notes

Omarchy bar widget `zoltanf.power` ("Power + Charger"), cloned from
`omarchy.power` with `omarchy plugin clone` on 2026-11-06. README.md covers
what it changes. **Public** GitHub repo `zoltanf/omarchy-power`, created
2026-11-07: keep home-network details and screenshots of the author's machine
out of it.

## State (2026-11-06)

- Installed on the author's laptop as a **symlink**
  `~/.config/omarchy/plugins/zoltanf.power` → this checkout, in place of
  `omarchy.power` (the clone switched the bar entry). `Model.js` is
  `.pragma library`: apply edits with `omarchy restart shell`.
- The first commit is the clone verbatim (Omarchy 4.5), so
  `git diff <first-commit>` shows every change, and newer Omarchy versions of
  `plugins/panels/power/` can be merged by diffing against it.
- Why it exists: upstream `Model.batteryIcon` returns the plain battery for a
  battery holding at its charge limit (UPower PendingCharge / "Not charging"),
  the same icon as on battery, and the panel only says "Threshold". The laptop
  sits at its 75–80% limit whenever it is plugged in.
- Changes: `pluggedIn` (= `!UPower.onBattery`) and `showPlugBadge`
  (plugged in and not charging) in `Panel.qml`; the bolt icons only while
  `charging`; a plug (`Model.PLUG_BADGE`, nf-md-power_plug) beside the
  battery in the bar (`iconComponent`) and in the panel's hero icon; status
  "Plugged in · holding at limit"; a full-width "Power source" row.
- Verified live, plugged in at the limit: bar plug, panel status and row.
  Not exercised: on battery, charging below the limit, fully charged (would
  need the charger unplugged or the limit changed).
- Battery history (2026-11-06): `busctl --json=short call org.freedesktop.UPower
  <battery path> org.freedesktop.UPower.Device GetHistory suu charge 0 1000`
  on open and once a minute while open; parsed and cut in `Model.js`
  (`parseHistory`, `historySeries`, `historyLine`, `historyPluggedSpans`;
  `node tests/run.js`). The history files under /var/lib/upower are root-only,
  hence D-Bus. UPower's timespan argument drops the row from before the window
  (the start level), so the full record is fetched (timespan 0); resolution 0
  returns nothing. Rows come only on 1% steps or state changes. Drawn as
  straight lines between rows since 2026-11-07: steps made sub-pixel stairs
  that looked jagged at 1h (each 1% is under a pixel tall).
  Fixed 0–100% scale. Verified with 6 h (flat, plugged in all day) and a
  temporary 24 h window (a 78→75% dip, the charger strip's gap).
- Ranges, hover, rate (2026-11-07): chips 1h/3h/6h/12h/1d/3d/7d
  (`Model.HISTORY_RANGES`) set `historyHours` (1–168) through `saveSetting`; midnight lines from 24 h up; a hover
  readout (cursor line, dot, tip with time · level · plugged in); the rate row
  adds %/h from the watts shown (`omarchy-battery-status`, the kernel's live
  `power_now`) / UPower's `energyCapacity`. Not UPower's `changeRate`: it is
  averaged and trailed the watts ("14W · 33%/h" on battery, 2026-11-07). GetHistory asks for
  up to 5000 rows (7 days on battery can pass 1000). Verified: the chips and
  the 1h/6h/3d/7d views render (set through shell.json, then restored).
  Not exercised by the agent: clicking a chip and hovering (no pointer
  injection; `hyprctl dispatch movecursor` sends no hover events). The %/h
  value was checked on battery (2026-11-07).

- Performance (2026-11-07): the 5 s refresh while open runs only
  `omarchy-battery-status`. Upstream's `omarchy-system-stats` call (about
  240 ms, output never shown) is gone. Profiles are read on open, after a pick,
  and 2 s after a plug or unplug while open (`refreshProfiles`). Battery info,
  profiles and history are fetched once at start (`prefetch`), so the first
  open is at its final size. `saveSetting` applies a setting at once and
  writes shell.json 0.8 s later (range chips, the right-click percentage
  toggle). The graph used `Shape.GeometryRenderer` while it drew steps; with
  sloped lines it is back on `Shape.CurveRenderer`, which antialiases. Verified: first open after
  a restart complete in its first frame; the percentage toggle over IPC (shown
  at once, written after 0.8 s); the 3-day steps look the same as with the
  curve renderer. Not exercised: the profile re-read after a pick or a plug.

- Health (2026-11-07): a "Health" row (`healthText`, from the laptop
  battery's `healthPercentage` in Quickshell's UPower, which is UPower's
  `capacity` = energy-full / energy-full-design) under Charge cycles; Power
  source moved from a full-width row into the right column beside it.
  `healthPercentage` is normalised if it comes as 0–1. Verified: 83% shown
  for UPower's 82.7%. `preview.png` redone with it (3-day view).

## Gotchas

- 2026-11-07: the shell froze (UI thread at 100%, IPC timing out) about 90 s
  after Home Assistant restarted; the `hass` plugin lost its websocket at
  01:08:27. The freeze began just after a test edit of this widget's range,
  but repeating the edit did not reproduce it. Suspect: the hass plugin's
  reconnect, not this widget.

- UPower writes an unknown-state row (state 0, level 0) at boot and resume, in
  the same second as the real row. `parseHistory` drops state-0 rows: kept,
  one sorted after its twin drew an 8-hour drop to 0% in the 3-day view.

- The bar background on this machine is `none`: a badge drawn over the glyph
  with a halo cut-out (netvpn's shield approach) merged into the battery. The
  plug therefore sits beside the battery, positioned from the glyph's painted
  bounds (`OpticalGlyph.paintedCenterX/Width`).
- New strings use `Commons.I18n.t(key, englishFallback)` with keys Omarchy's
  catalogs do not have (`power.pluggedInHolding`, `power.powerSource`,
  `power.acAdapter`, `power.sourceBattery`), so they are English in every
  language. A plugin `i18n/` catalog (see the omarchy skill's plugins.md)
  would translate them.
