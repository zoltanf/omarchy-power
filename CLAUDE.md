# omarchy-power: agent notes

Omarchy bar widget `zoltanf.power` ("Power + Charger"), cloned from
`omarchy.power` with `omarchy plugin clone` on 2026-11-06. README.md covers
what it changes. Local git repo only; no GitHub remote yet (ask before
creating one).

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
  returns nothing. Rows come only on 1% steps or state changes: drawn as steps.
  Fixed 0–100% scale. Verified with 6 h (flat, plugged in all day) and a
  temporary 24 h window (a 78→75% dip, the charger strip's gap).

## Gotchas

- The bar background on this machine is `none`: a badge drawn over the glyph
  with a halo cut-out (netvpn's shield approach) merged into the battery. The
  plug therefore sits beside the battery, positioned from the glyph's painted
  bounds (`OpticalGlyph.paintedCenterX/Width`).
- New strings use `Commons.I18n.t(key, englishFallback)` with keys Omarchy's
  catalogs do not have (`power.pluggedInHolding`, `power.powerSource`,
  `power.acAdapter`, `power.sourceBattery`), so they are English in every
  language. A plugin `i18n/` catalog (see the omarchy skill's plugins.md)
  would translate them.
