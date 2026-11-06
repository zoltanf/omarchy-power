function clampIndex(index, length) {
  if (length <= 0) return 0
  return Math.max(0, Math.min(length - 1, index))
}

function selectProfileIndex(index, delta, profiles) {
  var values = Array.isArray(profiles) ? profiles : []
  if (values.length === 0) return 0
  return clampIndex(index + delta, values.length)
}

function parseKeyValue(raw) {
  var next = {}
  var lines = String(raw || "").split("\n")
  for (var i = 0; i < lines.length; i++) {
    var idx = lines[i].indexOf("\t")
    if (idx <= 0) continue
    next[lines[i].substring(0, idx)] = lines[i].substring(idx + 1).trim()
  }
  return next
}

function parseProfiles(raw, previousIndex) {
  var lines = String(raw || "").split("\n")
  var list = []
  var active = ""
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim()
    if (!line) continue
    var parts = line.split("\t")
    list.push(parts[0])
    if (parts[1] === "1") active = parts[0]
  }
  return {
    profiles: list,
    activeProfile: active,
    profileIndex: clampIndex(previousIndex || 0, list.length)
  }
}

function profileIcon(name) {
  if (name === "power-saver") return "󰌪"
  if (name === "balanced") return "󰊚"
  if (name === "performance") return "󰓅"
  return "󰂄"
}

function batteryFraction(device) {
  return device && device.isPresent ? Math.max(0, Math.min(1, device.percentage)) : 0
}

function chargeThresholdActive(device, onBattery, states) {
  var d = device || {}
  var s = states || {}
  if (!(d && d.isPresent && !onBattery)) return false

  var fraction = batteryFraction(d)
  if (d.state === s.Discharging) return false
  if (d.state === s.PendingCharge) return true
  if (d.state === s.FullyCharged && fraction < 0.99) return true
  if (d.state !== s.Charging || fraction >= 0.99) return false

  return Number(d.changeRate || 0) <= 0.2 || Number(d.timeToFull || 0) >= 8 * 60 * 60
}

// The bolt means energy is flowing in: it shows only while charging. Plugged
// in but not charging (holding at the charge limit, or full) is the plain
// battery, and the panel adds the plug badge (PLUG_BADGE) for that.
var PLUG_BADGE = "󰚥"

function batteryIcon(device, charging) {
  var d = device || {}
  if (!d.isPresent) return ""

  var chargingIcons = ["󰢜", "󰂆", "󰂇", "󰂈", "󰢝", "󰂉", "󰢞", "󰂊", "󰂋", "󰂅"]
  var defaultIcons = ["󰁺", "󰁻", "󰁼", "󰁽", "󰁾", "󰁿", "󰂀", "󰂁", "󰂂", "󰁹"]
  var index = Math.max(0, Math.min(9, Math.floor(d.percentage * 10)))
  return charging ? chargingIcons[index] : defaultIcons[index]
}

function modeLabel(device, onBattery, states, tr) {
  var t = typeof tr === "function" ? tr : function(key, english) { return english }
  var d = device || {}
  if (!d.isPresent) return ""

  var percentage = d.isPresent ? d.percentage : 0
  if (chargeThresholdActive(d, onBattery, states)) return t("power.pluggedInHolding", "Plugged in · holding at limit")
  if (onBattery) return t("power.onBattery", "On battery")
  if (!onBattery && percentage >= 1) return t("power.fullyCharged", "Fully charged")
  return t("power.charging", "Charging")
}

// omarchy-battery-status --shell answers in plain digits with the unit
// attached ("13.1W", "75-80%"); the panel writes each number in the
// language's digits and decimal separator, keeping its decimals and unit.
function localizeReading(raw, fmt) {
  var f = typeof fmt === "function" ? fmt : function(v, d) { return d === undefined ? String(v) : Number(v).toFixed(d) }
  return String(raw === undefined || raw === null ? "" : raw).replace(/\d+(?:\.\d+)?/g, function(number) {
    var dot = number.indexOf(".")
    return f(Number(number), dot < 0 ? undefined : number.length - dot - 1)
  })
}

function profileLabel(name, tr) {
  var t = typeof tr === "function" ? tr : function(key, english) { return english }
  var value = String(name || "")
  if (value === "power-saver") return t("power.profilePowerSaver", "Power-saver")
  if (value === "balanced") return t("power.profileBalanced", "Balanced")
  if (value === "performance") return t("power.profilePerformance", "Performance")
  return value.charAt(0).toUpperCase() + value.slice(1)
}

if (typeof module !== "undefined") {
  module.exports = {
    clampIndex: clampIndex,
    selectProfileIndex: selectProfileIndex,
    parseKeyValue: parseKeyValue,
    parseProfiles: parseProfiles,
    profileIcon: profileIcon,
    batteryFraction: batteryFraction,
    chargeThresholdActive: chargeThresholdActive,
    batteryIcon: batteryIcon,
    modeLabel: modeLabel,
    profileLabel: profileLabel,
    localizeReading: localizeReading
  }
}

// ---------------------------------------------------------------- history
//
// The battery graph reads UPower's own charge record (GetHistory "charge"),
// so it covers the whole window from the first open: UPower writes a row on
// every 1% step or state change, in the background, whether the shell runs or
// not. The rows are fetched in full and cut here: UPower's own timespan filter
// drops the row from before the window, which is the level at its start.

// UPower device states that mean the charger is connected: charging, fully
// charged, pending charge (holding at the charge limit).
var PLUGGED_STATES = [1, 4, 5]

// D-Bus object path of a UPower battery from its native path ("BAT0").
function upowerBatteryPath(nativePath) {
  var name = String(nativePath || "").replace(/[^A-Za-z0-9_]/g, "_")
  return name === "" ? "" : "/org/freedesktop/UPower/devices/battery_" + name
}

// `busctl --json=short call ... GetHistory suu charge 0 N` →
// [{ t: seconds, v: percent, plugged: bool }] sorted by time. Anything that
// is not a well-formed row is dropped.
function parseHistory(text) {
  var rows = []
  try {
    var data = JSON.parse(String(text || "")).data
    var list = data && data[0] instanceof Array ? data[0] : []
    for (var i = 0; i < list.length; i++) {
      var r = list[i]
      if (!(r instanceof Array) || r.length < 3) continue
      var t = Number(r[0]), v = Number(r[1]), s = Number(r[2])
      if (!isFinite(t) || !isFinite(v) || t <= 0) continue
      rows.push({ t: t, v: Math.max(0, Math.min(100, v)), plugged: PLUGGED_STATES.indexOf(s) !== -1 })
    }
  } catch (e) {
    return []
  }
  rows.sort(function(a, b) { return a.t - b.t })
  return rows
}

// The points to draw for the last `windowSec` up to `nowSec`: the level at the
// window start (the last row before it), the rows inside, and the live level
// now. Empty when there is nothing to draw.
function historySeries(rows, nowSec, windowSec, nowPercent, nowPlugged) {
  if (!(rows instanceof Array) || !(nowSec > 0) || !(windowSec > 0)) return []
  var start = nowSec - windowSec
  var points = []
  var before = null
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i]
    if (r.t <= start) before = r
    else if (r.t < nowSec) points.push({ t: r.t, v: r.v, plugged: r.plugged })
  }
  if (before) points.unshift({ t: start, v: before.v, plugged: before.plugged })
  if (isFinite(nowPercent) && nowPercent >= 0)
    points.push({ t: nowSec, v: Math.max(0, Math.min(100, nowPercent)), plugged: !!nowPlugged })
  return points.length >= 2 ? points : []
}

// Step line through the series (UPower records changes, so a level holds
// until the next row), in a w×h box: [{x, y}].
function historyLine(points, nowSec, windowSec, w, h) {
  var out = []
  if (!(points instanceof Array) || points.length < 2 || !(w > 0) || !(h > 0)) return out
  var start = nowSec - windowSec
  function px(t) { return Math.max(0, Math.min(w, (t - start) / windowSec * w)) }
  function py(v) { return h - v / 100 * h }
  for (var i = 0; i < points.length; i++) {
    var x = px(points[i].t)
    if (i > 0) out.push({ x: x, y: py(points[i - 1].v) })
    out.push({ x: x, y: py(points[i].v) })
  }
  return out
}

// Stretches with the charger connected, merged: [{x, w}] in a box w wide.
function historyPluggedSpans(points, nowSec, windowSec, w) {
  var out = []
  if (!(points instanceof Array) || points.length < 2 || !(w > 0)) return out
  var start = nowSec - windowSec
  function px(t) { return Math.max(0, Math.min(w, (t - start) / windowSec * w)) }
  for (var i = 0; i < points.length - 1; i++) {
    if (!points[i].plugged) continue
    var x0 = px(points[i].t), x1 = px(points[i + 1].t)
    var last = out.length > 0 ? out[out.length - 1] : null
    if (last && Math.abs(last.x + last.w - x0) < 0.5) last.w = x1 - last.x
    else if (x1 > x0) out.push({ x: x0, w: x1 - x0 })
  }
  return out
}
