// node tests/run.js — stdlib only. Loads Model.js (a QML .pragma library)
// as plain JavaScript and checks the battery history helpers.
const fs = require("fs")
const path = require("path")
const src = fs.readFileSync(path.join(__dirname, "..", "Model.js"), "utf8").replace(/^\.pragma library\s*$/m, "")
const M = new Function(src + "\nreturn { upowerBatteryPath, parseHistory, historySeries, historyLine, historyPluggedSpans }")()

let passed = 0, failed = 0
function eq(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want)
  if (a === b) passed++
  else { failed++; console.log("FAIL " + name + "\n  got  " + a + "\n  want " + b) }
}

eq("path", M.upowerBatteryPath("BAT0"), "/org/freedesktop/UPower/devices/battery_BAT0")
eq("path sanitized", M.upowerBatteryPath("a/b c"), "/org/freedesktop/UPower/devices/battery_a_b_c")
eq("path empty", M.upowerBatteryPath(""), "")

const json = JSON.stringify({ type: "a(udu)", data: [[[300, 79, 1], [100, 80, 2], ["x", 5, 1], [200, 120, 5]]] })
eq("parse sorts, clamps, drops bad rows", M.parseHistory(json),
   [{ t: 100, v: 80, plugged: false }, { t: 200, v: 100, plugged: true }, { t: 300, v: 79, plugged: true }])
eq("parse garbage", M.parseHistory("not json"), [])
eq("parse no data", M.parseHistory("{}"), [])

const rows = [{ t: 100, v: 90, plugged: false }, { t: 500, v: 80, plugged: false }, { t: 800, v: 75, plugged: true }]
eq("series: start level from the row before the window", M.historySeries(rows, 1000, 600, 76, true),
   [{ t: 400, v: 90, plugged: false }, { t: 500, v: 80, plugged: false }, { t: 800, v: 75, plugged: true }, { t: 1000, v: 76, plugged: true }])
eq("series: data starting inside the window", M.historySeries(rows.slice(1), 1000, 900, 76, true),
   [{ t: 500, v: 80, plugged: false }, { t: 800, v: 75, plugged: true }, { t: 1000, v: 76, plugged: true }])
eq("series: flat (no rows in window)", M.historySeries([{ t: 10, v: 79, plugged: true }], 1000, 600, 79, true),
   [{ t: 400, v: 79, plugged: true }, { t: 1000, v: 79, plugged: true }])
eq("series: nothing", M.historySeries([], 1000, 600, 79, true), [])

const pts = [{ t: 400, v: 100, plugged: false }, { t: 700, v: 50, plugged: true }, { t: 1000, v: 50, plugged: true }]
eq("line steps", M.historyLine(pts, 1000, 600, 60, 10),
   [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 5 }, { x: 60, y: 5 }, { x: 60, y: 5 }])
eq("plugged spans merge", M.historyPluggedSpans(pts, 1000, 600, 60), [{ x: 30, w: 30 }])

console.log(passed + " passed, " + failed + " failed")
process.exit(failed ? 1 : 0)
