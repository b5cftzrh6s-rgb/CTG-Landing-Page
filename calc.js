/* ============================================================
   CTG shared calculation library (pure functions, no DOM).
   Used by every tool page (window.CTGCalc) and by node tests
   (require('./calc.js')). Keep all math here so it is tested.
   ============================================================ */
(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.CTGCalc = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- generic helpers ---------------- */
  function toNum(v) {
    if (v === null || v === undefined) return NaN;
    var s = String(v).trim();
    if (s === '') return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function csvField(v) {
    var s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQ = false, i = 0, len = text.length;
    if (text.charCodeAt(0) === 0xFEFF) i = 1; // strip BOM
    while (i < len) {
      var c = text.charAt(i);
      if (inQ) {
        if (c === '"') {
          if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  }

  /* ---------------- efflux cups ----------------
     V(cSt) = k*T - C/T. Valid ranges are DEFAULTS and editable in the UI.
     Formula constants for all four cups: GARDCO (Paul N. Gardner Co.).
     Valid time ranges: CTG settings (EZ-Zahn 20-80 s, ISO 30-100 s). */
  var CUPS = {
    'EZ-Zahn4': { label: 'EZ-Zahn #4', k: 13.26, C: 673, minSec: 20, maxSec: 80,
      source: 'GARDCO (Paul N. Gardner Co.)' },
    'EZ-Zahn5': { label: 'EZ-Zahn #5', k: 23.56, C: 744, minSec: 20, maxSec: 80,
      source: 'GARDCO (Paul N. Gardner Co.)' },
    'ISO6': { label: 'ISO #6', k: 6.90, C: 570, minSec: 30, maxSec: 100,
      source: 'GARDCO (Paul N. Gardner Co.)' },
    'ISO8': { label: 'ISO #8', k: 21.78, C: 306, minSec: 30, maxSec: 100,
      source: 'GARDCO (Paul N. Gardner Co.)' }
  };
  function cupCst(sec, cup) {
    var c = CUPS[cup];
    if (!c || !(sec > 0)) return null;
    return c.k * sec - c.C / sec;
  }
  /* Returns {ok, cst, reason}. Never returns ok with cst <= 0. */
  function cupCheck(sec, cup, range) {
    var c = CUPS[cup];
    if (!c) return { ok: false, cst: null, reason: 'unknown cup' };
    if (!(sec > 0) || !isFinite(sec)) return { ok: false, cst: null, reason: 'invalid seconds' };
    var lo = range && isFinite(range.minSec) ? range.minSec : c.minSec;
    var hi = range && isFinite(range.maxSec) ? range.maxSec : c.maxSec;
    var cst = cupCst(sec, cup);
    if (sec < lo) return { ok: false, cst: cst > 0 ? cst : null, reason: 'below cup range' };
    if (sec > hi) return { ok: false, cst: cst > 0 ? cst : null, reason: 'above cup range' };
    if (!(cst > 0)) return { ok: false, cst: null, reason: 'non-positive cSt' };
    return { ok: true, cst: cst, reason: '' };
  }

  /* ---------------- dates ---------------- */
  var DT_RE = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?)?$/;
  var ISO_RE = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
  /* Inspect sample strings: returns 'MDY', 'DMY', 'ISO' or 'ambiguous'/'unknown'. */
  function detectDateFormat(samples) {
    var mdyOnly = false, dmyOnly = false, any = false, iso = 0, n = 0;
    for (var i = 0; i < samples.length; i++) {
      var s = String(samples[i] == null ? '' : samples[i]).trim();
      if (!s) continue;
      n++;
      if (ISO_RE.test(s)) { iso++; continue; }
      var m = s.match(DT_RE);
      if (!m) continue;
      any = true;
      var a = +m[1], b = +m[2];
      if (a > 12 && b <= 12) dmyOnly = true;
      if (b > 12 && a <= 12) mdyOnly = true;
    }
    if (iso && iso === n) return 'ISO';
    if (!any) return 'unknown';
    if (mdyOnly && !dmyOnly) return 'MDY';
    if (dmyOnly && !mdyOnly) return 'DMY';
    return 'ambiguous';
  }
  /* fmt: 'MDY' | 'DMY'. Returns epoch ms (local time) or null. */
  function parseDateTime(str, fmt) {
    var s = String(str == null ? '' : str).trim();
    if (!s) return null;
    var m = s.match(ISO_RE);
    if (m) {
      var d0 = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
      return validDate(d0, +m[1], +m[2] - 1, +m[3]);
    }
    m = s.match(DT_RE);
    if (!m) return null;
    var a = +m[1], b = +m[2], y = +m[3];
    if (m[3].length === 2) y += 2000;
    var mo = fmt === 'DMY' ? b : a, da = fmt === 'DMY' ? a : b;
    var H = +(m[4] || 0), Mi = +(m[5] || 0), S = +(m[6] || 0);
    if (m[7]) { var pm = /p/i.test(m[7]); if (H === 12) H = 0; if (pm) H += 12; }
    if (H > 23 || Mi > 59 || S > 59) return null;
    return validDate(new Date(y, mo - 1, da, H, Mi, S), y, mo - 1, da);
  }
  function validDate(d, y, mo, da) {
    if (isNaN(d.getTime()) || d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== da) return null;
    return d.getTime();
  }

  /* ---------------- pairing ----------------
     rows: [{t: ms|null, cup: number|NaN, sensor: number|NaN}]
     Timestamp mode: for each cup reading, linear-interpolate between the
     nearest valid sensor samples before/after if both are within window;
     else use the nearest one within window; else unpaired.
     Row mode (no timestamps): same-row sensor, else mean of nearest
     valid rows before/after (legacy behaviour). */
  function validSensor(v) { return isFinite(v) && v > 0 && v !== -999 && Math.abs(v) < 1e10; }
  function pairReadings(rows, opts) {
    opts = opts || {};
    var useTime = opts.mode === 'time';
    var winMs = (isFinite(opts.windowMin) ? opts.windowMin : 5) * 60000;
    var out = [], unpaired = 0;
    var sensors = [];
    if (useTime) {
      for (var i = 0; i < rows.length; i++)
        if (rows[i].t !== null && isFinite(rows[i].t) && validSensor(rows[i].sensor)) sensors.push({ t: rows[i].t, v: rows[i].sensor });
      sensors.sort(function (a, b) { return a.t - b.t; });
    }
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      if (!(row.cup > 0)) continue;
      var res = null;
      if (useTime) {
        if (row.t === null || !isFinite(row.t)) { unpaired++; continue; }
        res = pairAtTime(sensors, row.t, winMs);
      } else {
        res = pairAtRow(rows, r);
      }
      if (!res) { unpaired++; continue; }
      out.push({ index: r, t: row.t, cup: row.cup, sensor: res.value, interpolated: res.interpolated, lagMin: res.lagMin });
    }
    return { pairs: out, unpaired: unpaired };
  }
  function pairAtTime(s, t, win) {
    var lo = 0, hi = s.length - 1, idx = s.length;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (s[mid].t >= t) { idx = mid; hi = mid - 1; } else lo = mid + 1; }
    var after = idx < s.length ? s[idx] : null;
    var before = idx > 0 ? s[idx - 1] : null;
    if (after && after.t === t) return { value: after.v, interpolated: false, lagMin: 0 };
    var bOk = before && (t - before.t) <= win, aOk = after && (after.t - t) <= win;
    if (bOk && aOk) {
      var f = (t - before.t) / (after.t - before.t);
      return { value: before.v + f * (after.v - before.v), interpolated: true,
        lagMin: Math.min(t - before.t, after.t - t) / 60000 };
    }
    if (bOk) return { value: before.v, interpolated: true, lagMin: (t - before.t) / 60000 };
    if (aOk) return { value: after.v, interpolated: true, lagMin: (after.t - t) / 60000 };
    return null;
  }
  function pairAtRow(rows, i) {
    if (validSensor(rows[i].sensor)) return { value: rows[i].sensor, interpolated: false, lagMin: null };
    var b = null, f = null;
    for (var j = i - 1; j >= 0; j--) if (validSensor(rows[j].sensor)) { b = rows[j].sensor; break; }
    for (var k = i + 1; k < rows.length; k++) if (validSensor(rows[k].sensor)) { f = rows[k].sensor; break; }
    if (b !== null && f !== null) return { value: (b + f) / 2, interpolated: true, lagMin: null };
    if (b !== null) return { value: b, interpolated: true, lagMin: null };
    if (f !== null) return { value: f, interpolated: true, lagMin: null };
    return null;
  }

  /* ---------------- original (origin/main) CSV layout ----------------
     ECOLAB 3D-style export: column headers on Excel row 15 (index 14),
     data from Excel row 16 (index 15); blank rows skipped. */
  var HEADER_ROW_INDEX = 14, DATA_START_INDEX = 15;
  function splitExport(parsed, headerRowIndex) {
    var hr = headerRowIndex == null ? HEADER_ROW_INDEX : headerRowIndex;
    if (parsed.length <= hr) throw new Error('The file has only ' + parsed.length + ' rows; header expected on row ' + (hr + 1) + '.');
    var head = parsed[hr].map(function (h) { return String(h == null ? '' : h).trim(); });
    if (!head.some(function (h) { return h; })) throw new Error('Header row ' + (hr + 1) + ' is empty. Check the header row number.');
    var rows = parsed.slice(hr + 1).filter(function (r) { return r && r.some(function (c) { return String(c == null ? '' : c).trim(); }); });
    if (!rows.length) throw new Error('No data rows after header row ' + (hr + 1) + '.');
    return { headers: head, rows: rows };
  }
  /* Identical rules to origin/main autoDetectColumns (first match wins). */
  function detectColumns(headers) {
    var out = { date: '', manual: '', sensor: '' };
    for (var i = 0; i < headers.length; i++) {
      var hl = String(headers[i] || '').toLowerCase();
      if (hl.indexOf('date') !== -1 || hl.indexOf('time') !== -1) { if (out.date === '') out.date = String(i); }
      if (hl.indexOf('zahn') !== -1 || hl.indexOf('efflux') !== -1 || hl.indexOf('cup') !== -1 || hl.indexOf('sec') !== -1) { if (out.manual === '') out.manual = String(i); }
      if (hl.indexOf('viscosity') !== -1 || (hl.indexOf('cp') !== -1 && hl.indexOf('cup') === -1)) { if (out.sensor === '') out.sensor = String(i); }
    }
    return out;
  }
  /* Export identical to origin/main downloadCSV:
     DateTime,CupSec,CalcCst,SensorCP,AbsDiff,Interpolated[,Shift]
     DateTime = local MM/DD/YYYY HH:MM, numbers toFixed(3). */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function formatDateTimeMDY(t) {
    if (t === null || t === undefined || !isFinite(t)) return '';
    var d = new Date(t);
    return pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) + '/' + d.getFullYear() + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function exportCSV(rows, withShift) {
    var f3 = function (v) { return v === null || v === undefined || !isFinite(v) ? '' : v.toFixed(3); };
    var c = 'DateTime,CupSec,CalcCst,SensorCP,AbsDiff,Interpolated' + (withShift ? ',Shift' : '') + '\n';
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      c += formatDateTimeMDY(p.t) + ',' + f3(p.cup) + ',' + f3(p.cst) + ',' + f3(p.sensor) + ',' + f3(p.absDiff) + ',' + (p.interpolated ? 'Yes' : 'No') + (withShift ? ',' + p.shift : '') + '\n';
    }
    return c;
  }

  /* ---------------- statistics ---------------- */
  function linearRegression(x, y) {
    var n = x.length, sx = 0, sy = 0, sxy = 0, sx2 = 0;
    for (var i = 0; i < n; i++) { sx += x[i]; sy += y[i]; sxy += x[i] * y[i]; sx2 += x[i] * x[i]; }
    var d = n * sx2 - sx * sx;
    var m = d === 0 ? 0 : (n * sxy - sx * sy) / d;
    var b = n ? (sy - m * sx) / n : 0;
    return { m: m, b: b, fn: function (xi) { return m * xi + b; } };
  }
  function rSquared(x, y, fn) {
    var n = y.length; if (!n) return 0;
    var mean = 0; for (var i = 0; i < n; i++) mean += y[i]; mean /= n;
    var ssr = 0, sst = 0;
    for (var j = 0; j < n; j++) { var p = fn(x[j]); ssr += (y[j] - p) * (y[j] - p); sst += (y[j] - mean) * (y[j] - mean); }
    return sst === 0 ? 0 : 1 - ssr / sst;
  }
  function residualSD(x, y, fn) {
    var n = x.length; if (n < 3) return NaN;
    var s = 0; for (var i = 0; i < n; i++) { var e = y[i] - fn(x[i]); s += e * e; }
    return Math.sqrt(s / (n - 2));
  }
  function projectLimits(fit, lsl, usl, ys) {
    var l = fit.fn(lsl), h = fit.fn(usl);
    if (l > h) { var t = l; l = h; h = t; }
    var ok = 0; for (var i = 0; i < ys.length; i++) if (ys[i] >= l && ys[i] <= h) ok++;
    return { lsl: l, usl: h, coverage: ys.length ? ok / ys.length * 100 : 0 };
  }
  function timeToMinutes(t) {
    var m = String(t == null ? '' : t).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    var h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }
  function inShift(t, s, e) {
    if (s === null || e === null || s === e) return false;
    return e > s ? (t >= s && t < e) : (t >= s || t < e);
  }

  /* ---------------- value worksheet ----------------
     All % inputs are 0-100. Returns drivers (low/high), totals, warnings. */
  var VALUE_LIMITS = {
    parts: [0, 1e9], scrapPct: [0, 100], shellShare: [0, 100], reductionPct: [0, 100],
    costLow: [0, 1e7], costHigh: [0, 1e7], scrapDollars: [0, 1e10],
    priceLow: [0, 1e7], priceHigh: [0, 1e7], vcPct: [0, 100],
    tanks: [0, 1000], laborRate: [0, 1000], readsPerDay: [0, 1000], minsPerReading: [0, 600],
    daysPerYear: [0, 366], laborReductionPct: [0, 100],
    reworkHoursMonth: [0, 10000], reworkRate: [0, 1000], reworkReductionPct: [0, 100],
    slurryCostPerTankYear: [0, 1e8], slurryReductionPct: [0, 100],
    downtimeHoursYear: [0, 8784], downtimeCostHour: [0, 1e7], downtimeReductionPct: [0, 100],
    incidentsYear: [0, 10000], costPerIncident: [0, 1e8], safetyReductionPct: [0, 100]
  };
  function validateValueInputs(inp) {
    var errors = {};
    for (var k in VALUE_LIMITS) {
      if (!Object.prototype.hasOwnProperty.call(inp, k)) continue;
      var v = inp[k];
      if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) continue;
      var n = Number(v), lim = VALUE_LIMITS[k];
      if (!isFinite(n)) errors[k] = 'Not a number';
      else if (n < lim[0]) errors[k] = 'Must be ≥ ' + lim[0];
      else if (n > lim[1]) errors[k] = 'Must be ≤ ' + lim[1];
    }
    return errors;
  }
  function rng(lo, hi) {
    lo = isFinite(lo) ? lo : NaN; hi = isFinite(hi) ? hi : NaN;
    if (isNaN(lo) && !isNaN(hi)) lo = hi;
    if (isNaN(hi) && !isNaN(lo)) hi = lo;
    if (isNaN(lo)) lo = hi = 0;
    if (lo > hi) { var t = lo; lo = hi; hi = t; }
    return { lo: lo, hi: hi };
  }
  function computeValue(inp) {
    var errors = validateValueInputs(inp);
    var g = function (k) { var v = Number(inp[k]); return (errors[k] || !isFinite(v) || inp[k] === '' || inp[k] == null) ? 0 : v; };
    var gr = function (k) { var v = Number(inp[k]); return (errors[k] || inp[k] === '' || inp[k] == null || !isFinite(v)) ? NaN : v; };
    var pct = function (k) { return g(k) / 100; };
    var d = {}, warnings = [];
    var mode = inp.mode === 'B' ? 'B' : 'A';
    var recovered = 0;
    if (mode === 'A') {
      recovered = g('parts') * pct('scrapPct') * pct('shellShare') * pct('reductionPct');
      var cost = rng(gr('costLow'), gr('costHigh'));
      d.scrap = { lo: recovered * cost.lo, hi: recovered * cost.hi,
        formula: 'Annual parts × scrap % × shell-related share % × expected reduction % × cost per scrapped part' };
    } else {
      var v = g('scrapDollars') * pct('shellShare') * pct('reductionPct');
      d.scrap = { lo: v, hi: v, formula: 'Annual scrap $ (all causes) × shell-related share % × expected reduction %' };
    }
    if (inp.capacityConstrained && mode === 'A') {
      var price = rng(gr('priceLow'), gr('priceHigh')), cm = 1 - pct('vcPct');
      d.revenue = { lo: recovered * price.lo * cm, hi: recovered * price.hi * cm,
        formula: 'Recovered parts × selling price × (1 − variable cost %). Only counted when the plant is capacity-constrained (every recovered part is an extra sale).' };
    } else {
      d.revenue = { lo: 0, hi: 0, formula: inp.capacityConstrained ? 'Requires part-level inputs (Method A).' : 'Not counted: plant not capacity-constrained.' };
    }
    var labor = g('tanks') * g('readsPerDay') * g('minsPerReading') / 60 * g('daysPerYear') * g('laborRate') * pct('laborReductionPct');
    d.labor = { lo: labor, hi: labor, formula: 'Tanks × readings/day × minutes/reading ÷ 60 × days/yr × labor rate × reading-time reduction %' };
    var rework = g('reworkHoursMonth') * 12 * g('reworkRate') * pct('reworkReductionPct');
    d.rework = { lo: rework, hi: rework, formula: 'Rework hours/month × 12 × rework labor rate × reduction %' };
    var slurry = g('tanks') * g('slurryCostPerTankYear') * pct('slurryReductionPct');
    d.slurry = { lo: slurry, hi: slurry, formula: 'Tanks × annual slurry replacement cost per tank × reduction %' };
    var dt = g('downtimeHoursYear') * g('downtimeCostHour') * pct('downtimeReductionPct');
    d.downtime = { lo: dt, hi: dt, formula: 'Slurry-related downtime hours/yr × cost/hr × reduction %' };
    var sf = g('incidentsYear') * g('costPerIncident') * pct('safetyReductionPct');
    d.safety = { lo: sf, hi: sf, formula: 'Incidents/yr × cost per incident × reduction %' };
    /* Any invalid input zeroes its whole driver (never silently inflates). */
    var DRIVER_FIELDS = {
      scrap: ['parts', 'scrapPct', 'shellShare', 'reductionPct', 'costLow', 'costHigh', 'scrapDollars'],
      revenue: ['priceLow', 'priceHigh', 'vcPct', 'parts', 'scrapPct', 'shellShare', 'reductionPct'],
      labor: ['tanks', 'readsPerDay', 'minsPerReading', 'daysPerYear', 'laborRate', 'laborReductionPct'],
      rework: ['reworkHoursMonth', 'reworkRate', 'reworkReductionPct'],
      slurry: ['tanks', 'slurryCostPerTankYear', 'slurryReductionPct'],
      downtime: ['downtimeHoursYear', 'downtimeCostHour', 'downtimeReductionPct'],
      safety: ['incidentsYear', 'costPerIncident', 'safetyReductionPct']
    };
    var lo = 0, hi = 0;
    for (var k in d) {
      if (DRIVER_FIELDS[k].some(function (f) { return errors[f]; })) { d[k].lo = 0; d[k].hi = 0; d[k].invalid = true; }
      lo += d[k].lo; hi += d[k].hi;
    }
    if (Object.keys(errors).length) warnings.push('Some inputs are out of range; the affected value drivers are set to $0 until fixed.');
    if (mode === 'A' && g('parts') > 0 && !(g('shellShare') > 0)) warnings.push('Shell-related share is 0 %, so scrap value is $0. Enter the share of scrap caused by shell defects.');
    if (g('reductionPct') > 50) warnings.push('Expected scrap reduction above 50 % is aggressive; support it with site data or a trial.');
    if (inp.capacityConstrained && mode === 'B') warnings.push('Revenue uplift needs part counts and prices (Method A).');
    return { drivers: d, total: { lo: lo, hi: hi, mid: (lo + hi) / 2 }, recoveredParts: recovered, errors: errors, warnings: warnings };
  }

  /* ---------------- slurry recipe ---------------- */
  var LB_PER_GAL_WATER = 8.345, L_PER_GAL = 3.78541;
  var TABLE_7667 = [[0, 7.0], [10, 7.3], [20, 7.6], [30, 7.9], [40, 8.2], [50, 8.5], [60, 8.8], [70, 9.1], [80, 9.4], [90, 9.7], [100, 10.0]];
  function dose7667(pctZircon) {
    var t = TABLE_7667;
    if (!(pctZircon > 0)) return t[0][1];
    if (pctZircon >= 100) return t[t.length - 1][1];
    for (var i = 0; i < t.length - 1; i++) {
      if (pctZircon >= t[i][0] && pctZircon <= t[i + 1][0])
        return t[i][1] + (pctZircon - t[i][0]) / (t[i + 1][0] - t[i][0]) * (t[i + 1][1] - t[i][1]);
    }
    return t[0][1];
  }
  /* inp: {binder:{solids,density,poly}|null, binderLb, waterLb, polymerLb,
     polymerSolidsPct (default 50), polymerSG (default 1.0),
     refs:[{name, sg, lb, isZircon}], wetting:bool, antifoamMlPerL} */
  function slurryRecipe(inp) {
    var warnings = [];
    var pos = function (v, name) { v = Number(v); if (!isFinite(v) || v === 0) return 0; if (v < 0) { warnings.push(name + ' is negative; treated as 0.'); return 0; } return v; };
    var b = inp.binder;
    var bw = pos(inp.binderLb, 'Binder weight'), ww = pos(inp.waterLb, 'Water weight'), pw = pos(inp.polymerLb, 'Polymer weight');
    var ps = isFinite(Number(inp.polymerSolidsPct)) && inp.polymerSolidsPct !== '' && inp.polymerSolidsPct != null ? Number(inp.polymerSolidsPct) : 50;
    if (ps < 0 || ps > 100) { warnings.push('Polymer solids must be 0-100 %; using 50 %.'); ps = 50; }
    var psg = Number(inp.polymerSG); if (!(psg > 0)) psg = 1.0;
    var refW = 0, refVol = 0, zirc = 0;
    (inp.refs || []).forEach(function (r, i) {
      var w = pos(r.lb, 'Refractory #' + (i + 1) + ' weight');
      if (w > 0 && !(r.sg > 0)) { warnings.push('Refractory #' + (i + 1) + ' is "None" but has ' + w + ' lb; that weight was ignored. Pick a material.'); return; }
      refW += w; refVol += w > 0 ? w / (r.sg * LB_PER_GAL_WATER) : 0;
      if (r.isZircon) zirc += w;
    });
    var binderVol = b && b.density > 0 ? bw / (b.density * LB_PER_GAL_WATER) : 0;
    var liqGal = binderVol + ww / LB_PER_GAL_WATER + pw / (psg * LB_PER_GAL_WATER);
    var liquidLb = bw + ww + pw;
    var total = liquidLb + refW;
    var volGal = liqGal + refVol;
    var sg = volGal > 0 ? total / (volGal * LB_PER_GAL_WATER) : 0;
    var silicaLb = b ? bw * b.solids / 100 : 0;
    var polySolidsLb = pw * ps / 100;
    var dry = silicaLb + polySolidsLb + refW;
    var activePoly = (b ? bw * b.poly / 100 : 0) + polySolidsLb;
    var pctZ = refW > 0 ? zirc / refW * 100 : 0;
    var dosePerGal = dose7667(pctZ);
    return {
      totalLb: total, volumeGal: volGal, volumeL: volGal * L_PER_GAL, sg: sg, lbPerGal: sg * LB_PER_GAL_WATER,
      pctRefractory: total > 0 ? refW / total * 100 : 0,
      pctSolids: total > 0 ? dry / total * 100 : 0,
      pctSilicaInLiquid: liquidLb > 0 ? silicaLb / liquidLb * 100 : 0,
      pctPolymerInLiquid: liquidLb > 0 ? activePoly / liquidLb * 100 : 0,
      pctZircon: pctZ, liquidGal: liqGal, liquidL: liqGal * L_PER_GAL,
      dose7667MlPerGal: inp.wetting ? dosePerGal : null,
      total7667Ml: inp.wetting ? dosePerGal * liqGal : null,
      antifoamMl: inp.antifoamMlPerL > 0 ? inp.antifoamMlPerL * liqGal * L_PER_GAL : null,
      warnings: warnings
    };
  }

  /* ---------------- biocide addition (6451) ----------------
     grams = dose% / 100 × liquid grams;  mL = grams ÷ product density.
     Liquid grams = lb × 454 g/lb (spec factor), or kg × 1000. */
  var BIOCIDE_DEFAULTS = { dosePct: 0.15, gPerLb: 454, densityGmL: 1.145 };
  /* 0.15 % is the MAXIMUM dose (spec). Medium/Low are adjustable defaults. */
  var BIOCIDE_TIERS = [{ id: 'max', label: 'Maximum', pct: 0.15 }, { id: 'med', label: 'Medium', pct: 0.10 }, { id: 'low', label: 'Low', pct: 0.05 }];
  function biocideDose(inp) {
    inp = inp || {};
    var errors = {};
    var unit = inp.unit === 'kg' ? 'kg' : 'lb';
    var pick = function (k) { var v = inp[k]; return (v === '' || v == null) ? BIOCIDE_DEFAULTS[k] : Number(v); };
    var amt = (inp.liquid === '' || inp.liquid == null) ? NaN : Number(inp.liquid);
    var dose = pick('dosePct'), gpl = pick('gPerLb'), dens = pick('densityGmL');
    if (!(amt > 0)) errors.liquid = 'Enter a liquid weight greater than 0';
    if (!(dose > 0) || dose > 100) errors.dosePct = 'Dose must be > 0 and ≤ 100 %';
    if (!(gpl > 0)) errors.gPerLb = 'Must be greater than 0';
    if (!(dens > 0)) errors.densityGmL = 'Density must be greater than 0';
    if (Object.keys(errors).length) return { ok: false, errors: errors, grams: null, mL: null };
    var liquidG = unit === 'kg' ? amt * 1000 : amt * gpl;
    var grams = dose / 100 * liquidG;
    return { ok: true, errors: {}, unit: unit, liquidG: liquidG, grams: grams, mL: grams / dens, dosePct: dose, gPerLb: gpl, densityGmL: dens };
  }

  /* inp: {liquid, unit, gPerLb, densityGmL, maxPct, medPct, lowPct} -> tiers [{id,label,pct,grams,mL,errors}] */
  function biocideTiers(inp) {
    inp = inp || {};
    var tiers = BIOCIDE_TIERS.map(function (t) {
      var v = inp[t.id + 'Pct'], pct = (v === '' || v == null) ? t.pct : v;
      var r = biocideDose({ liquid: inp.liquid, unit: inp.unit, gPerLb: inp.gPerLb, densityGmL: inp.densityGmL, dosePct: pct });
      return { id: t.id, label: t.label, pct: Number(pct), grams: r.grams, mL: r.mL, ok: r.ok, errors: r.errors };
    });
    var warnings = [];
    var mx = tiers[0].pct;
    tiers.slice(1).forEach(function (t) { if (t.pct > mx) warnings.push(t.label + ' dose (' + t.pct + ' %) is above the maximum (' + mx + ' %).'); });
    return { tiers: tiers, warnings: warnings };
  }

  /* ---------------- tank RPM ---------------- */
  var IN_TO_M = 0.0254;
  function tankRpm(diameterIn, vpMPerMin) {
    var d = Number(diameterIn) * IN_TO_M, v = Number(vpMPerMin);
    if (!(d > 0) || !(v > 0)) return null;
    return v / (Math.PI * d);
  }

  return {
    toNum: toNum, escapeHtml: escapeHtml, csvField: csvField, parseCSV: parseCSV,
    CUPS: CUPS, cupCst: cupCst, cupCheck: cupCheck,
    detectDateFormat: detectDateFormat, parseDateTime: parseDateTime,
    HEADER_ROW_INDEX: HEADER_ROW_INDEX, DATA_START_INDEX: DATA_START_INDEX, splitExport: splitExport, detectColumns: detectColumns,
    formatDateTimeMDY: formatDateTimeMDY, exportCSV: exportCSV,
    validSensor: validSensor, pairReadings: pairReadings,
    linearRegression: linearRegression, rSquared: rSquared, residualSD: residualSD, projectLimits: projectLimits,
    timeToMinutes: timeToMinutes, inShift: inShift,
    VALUE_LIMITS: VALUE_LIMITS, validateValueInputs: validateValueInputs, computeValue: computeValue,
    TABLE_7667: TABLE_7667, dose7667: dose7667, slurryRecipe: slurryRecipe, LB_PER_GAL_WATER: LB_PER_GAL_WATER,
    BIOCIDE_DEFAULTS: BIOCIDE_DEFAULTS, biocideDose: biocideDose, BIOCIDE_TIERS: BIOCIDE_TIERS, biocideTiers: biocideTiers,
    IN_TO_M: IN_TO_M, tankRpm: tankRpm
  };
});
