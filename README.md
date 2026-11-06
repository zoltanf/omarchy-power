# omarchy-power

An Omarchy bar widget (`zoltanf.power`, "Power + Charger") that replaces the
stock `omarchy.power`. It is Omarchy's own battery and power-profile widget,
changed so you can always see when the charger is connected.

The stock widget shows the charger only while the battery charges. A laptop
with a charge limit (for example 75–80%) spends most of its plugged-in time
holding at that limit, and there the stock widget looks exactly like it does
on battery.

- **Bar:** a small plug next to the battery icon while the charger is connected
  and the battery is not charging (holding at the limit, or full). While it
  charges, the icon shows the bolt as before.
- **Panel:** the status line says "Plugged in · holding at limit" instead of
  "Threshold", the large battery icon gets the same plug, and a **Power
  source** row reads "AC adapter" or "Battery".
- **Battery history:** a graph of the battery level, with a strip under it
  where the charger was connected. Buttons over it switch between the last
  1, 3, 6 and 12 hours and 1, 3 and 7 days, and the choice is remembered
  (`historyHours` in the widget's `shell.json` entry). Hover the graph for the
  time and level at that point; the longer views mark each midnight with a
  faint line. It reads UPower's own charge record, so it covers the whole
  window from the first open; nothing runs in the background for it.
- **Charge rate:** while charging or on battery, the rate row adds the share
  of the battery per hour to the watts, for example `13.1W · 35%/h`.

Everything else (power profiles, battery size, cycles, charge limit, the
right-click percentage toggle) works as in the stock widget.

## Install

```sh
omarchy plugin add <repository URL> --enable
```

The plugin declares itself a replacement for `omarchy.power`
(`"clonedFrom": "omarchy.power"` in `manifest.json`), so enabling it puts it
in the stock widget's place in the bar.

## Removal

To go back to the stock widget, disable this one:

```sh
omarchy plugin disable zoltanf.power
```

To uninstall it completely:

```sh
omarchy plugin remove zoltanf.power
```

## License

MIT. The code comes from Omarchy's own power widget and keeps its MIT notice
(© David Heinemeier Hansson, [LICENSE.omarchy](LICENSE.omarchy)).
