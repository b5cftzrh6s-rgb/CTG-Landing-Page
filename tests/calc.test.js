// Run: node tests/calc.test.js   (no dependencies)
'use strict';
var C = require('../calc.js');
var assert = require('assert');
var passed = 0, failed = 0;
function t(name, fn) { try { fn(); passed++; console.log('  ok  ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); } }
function near(a, b, eps) { assert.ok(Math.abs(a - b) <= (eps || 1e-6), a + ' !~ ' + b); }

console.log('cups');
t('EZ-Zahn5 at 30 s = 682.0 cSt', function () { near(C.cupCst(30, 'EZ-Zahn5'), 23.56 * 30 - 744 / 30); near(C.cupCst(30, 'EZ-Zahn5'), 682, 0.01); });
t('ISO6 at 5 s is rejected, never negative', function () { var r = C.cupCheck(5, 'ISO6'); assert.strictEqual(r.ok, false); assert.strictEqual(r.cst, null); });
t('ISO6 at 50 s ok', function () { var r = C.cupCheck(50, 'ISO6'); assert.ok(r.ok); near(r.cst, 6.9 * 50 - 570 / 50); });
t('above range flagged', function () { assert.strictEqual(C.cupCheck(120, 'EZ-Zahn4').reason, 'above cup range'); });
t('custom range honoured', function () { assert.ok(C.cupCheck(15, 'EZ-Zahn5', { minSec: 10, maxSec: 90 }).ok); });
t('custom range cannot allow negative cSt', function () { var r = C.cupCheck(3, 'EZ-Zahn4', { minSec: 1, maxSec: 90 }); assert.strictEqual(r.ok, false); assert.strictEqual(r.reason, 'non-positive cSt'); });
t('no cup at any in-range time gives cSt <= 0', function () {
  Object.keys(C.CUPS).forEach(function (k) { var c = C.CUPS[k]; for (var s = c.minSec; s <= c.maxSec; s += 0.5) assert.ok(C.cupCst(s, k) > 0, k + '@' + s); });
});

console.log('dates');
t('detect MDY', function () { assert.strictEqual(C.detectDateFormat(['03/04/2026', '03/25/2026 10:00']), 'MDY'); });
t('detect DMY', function () { assert.strictEqual(C.detectDateFormat(['25/03/2026', '04/03/2026']), 'DMY'); });
t('detect ambiguous', function () { assert.strictEqual(C.detectDateFormat(['03/04/2026', '05/06/2026']), 'ambiguous'); });
t('detect ISO', function () { assert.strictEqual(C.detectDateFormat(['2026-03-04 10:00']), 'ISO'); });
t('parse DMY vs MDY', function () {
  assert.strictEqual(new Date(C.parseDateTime('03/04/2026', 'DMY')).getMonth(), 3);
  assert.strictEqual(new Date(C.parseDateTime('03/04/2026', 'MDY')).getMonth(), 2);
});
t('reject impossible date 31/02', function () { assert.strictEqual(C.parseDateTime('31/02/2026', 'DMY'), null); });
t('parse 12-hour PM', function () { assert.strictEqual(new Date(C.parseDateTime('3/4/2026 1:30 PM', 'MDY')).getHours(), 13); });

console.log('pairing');
var T0 = new Date(2026, 0, 1, 8, 0).getTime(), M = 60000;
t('time pairing interpolates within window', function () {
  var rows = [{ t: T0, cup: NaN, sensor: 100 }, { t: T0 + 2 * M, cup: 30, sensor: NaN }, { t: T0 + 4 * M, cup: NaN, sensor: 200 }];
  var r = C.pairReadings(rows, { mode: 'time', windowMin: 5 });
  assert.strictEqual(r.pairs.length, 1); near(r.pairs[0].sensor, 150); near(r.pairs[0].lagMin, 2);
});
t('time pairing rejects outside window', function () {
  var rows = [{ t: T0, cup: NaN, sensor: 100 }, { t: T0 + 120 * M, cup: 30, sensor: NaN }];
  var r = C.pairReadings(rows, { mode: 'time', windowMin: 10 });
  assert.strictEqual(r.pairs.length, 0); assert.strictEqual(r.unpaired, 1);
});
t('time pairing ignores row order', function () {
  var rows = [{ t: T0 + 10 * M, cup: 30, sensor: NaN }, { t: T0 + 50 * M, cup: NaN, sensor: 999 }, { t: T0 + 9 * M, cup: NaN, sensor: 120 }];
  var r = C.pairReadings(rows, { mode: 'time', windowMin: 5 }); near(r.pairs[0].sensor, 120);
});
t('row fallback averages neighbours', function () {
  var rows = [{ t: null, cup: NaN, sensor: 100 }, { t: null, cup: 30, sensor: NaN }, { t: null, cup: NaN, sensor: 200 }];
  near(C.pairReadings(rows, { mode: 'row' }).pairs[0].sensor, 150);
});

console.log('stats');
t('regression exact line', function () { var f = C.linearRegression([1, 2, 3], [3, 5, 7]); near(f.m, 2); near(f.b, 1); near(C.rSquared([1, 2, 3], [3, 5, 7], f.fn), 1); });
t('limits projection', function () { var f = C.linearRegression([1, 2, 3], [3, 5, 7]); var l = C.projectLimits(f, 1, 2, [3, 4, 6]); near(l.lsl, 3); near(l.usl, 5); near(l.coverage, 200 / 3); });
t('overnight shift', function () { assert.ok(C.inShift(23 * 60, 22 * 60, 6 * 60)); assert.ok(!C.inShift(12 * 60, 22 * 60, 6 * 60)); });
t('csv parser quotes + BOM', function () { var r = C.parseCSV('\uFEFFa,"b,c","d""e"\n1,2,3'); assert.deepStrictEqual(r[0], ['a', 'b,c', 'd"e']); });
t('csvField escapes', function () { assert.strictEqual(C.csvField('a,b'), '"a,b"'); });
t('escapeHtml', function () { assert.strictEqual(C.escapeHtml('<b x="1">'), '&lt;b x=&quot;1&quot;&gt;'); });

console.log('original export layout (origin/main parity)');
var fs = require('fs'), path = require('path'), REF = require('./reference-main.js');
var LAYOUT = fs.readFileSync(path.join(__dirname, 'sample-original-layout.csv'), 'utf8');
function newPipeline(text, cup, mode, windowMin) {
  var sp = C.splitExport(C.parseCSV(text)), det = C.detectColumns(sp.headers);
  var fmt = C.detectDateFormat(sp.rows.map(function (r) { return r[+det.date]; }));
  fmt = fmt === 'DMY' ? 'DMY' : 'MDY';
  var rows = sp.rows.map(function (r) { return { t: C.parseDateTime(r[+det.date], fmt), cup: parseFloat(r[+det.manual]), sensor: parseFloat(r[+det.sensor]) }; });
  var res = C.pairReadings(rows, { mode: mode, windowMin: windowMin });
  var out = res.pairs.filter(function (p) { return C.cupCheck(p.cup, cup).ok; }).map(function (p) {
    var cst = C.cupCst(p.cup, cup); return { t: p.t, cup: p.cup, cst: cst, sensor: p.sensor, absDiff: Math.abs(cst * 1.0 - p.sensor), interpolated: p.interpolated };
  });
  return { sp: sp, det: det, csv: C.exportCSV(out, false) };
}
t('default header row 15 / data row 16 like main', function () { assert.strictEqual(C.HEADER_ROW_INDEX, REF.HEADER_ROW_INDEX); assert.strictEqual(C.DATA_START_INDEX, REF.DATA_START_INDEX); });
t('same headers and data rows as main', function () {
  var ref = REF.run(LAYOUT, 'EZ-Zahn5'), n = newPipeline(LAYOUT, 'EZ-Zahn5', 'row');
  assert.deepStrictEqual(n.sp.headers, ref.headers); assert.deepStrictEqual(n.sp.rows, ref.rows);
});
t('same auto-detected columns as main', function () { assert.deepStrictEqual(newPipeline(LAYOUT, 'EZ-Zahn5', 'row').det, REF.run(LAYOUT, 'EZ-Zahn5').detected); });
t('column detection examples', function () {
  assert.deepStrictEqual(C.detectColumns(['Date/Time', 'Zahn #5 Cup (sec)', 'Viscosity (cP)']), { date: '0', manual: '1', sensor: '2' });
  assert.deepStrictEqual(C.detectColumns(['Timestamp', 'Efflux', 'Sensor cP']), { date: '0', manual: '1', sensor: '2' });
});
t('row-order export byte-identical to main', function () { var ref = REF.run(LAYOUT, 'EZ-Zahn5'); assert.ok(ref.n > 10); assert.strictEqual(newPipeline(LAYOUT, 'EZ-Zahn5', 'row').csv, ref.csv); });
t('timestamp export identical to main on evenly spaced export (window 15 min)', function () { assert.strictEqual(newPipeline(LAYOUT, 'EZ-Zahn5', 'time', 15).csv, REF.run(LAYOUT, 'EZ-Zahn5').csv); });
t('export header identical to main', function () { assert.strictEqual(C.exportCSV([], false), 'DateTime,CupSec,CalcCst,SensorCP,AbsDiff,Interpolated\n'); assert.strictEqual(C.exportCSV([], true).split('\n')[0], 'DateTime,CupSec,CalcCst,SensorCP,AbsDiff,Interpolated,Shift'); });
t('header row too far -> clear error', function () { assert.throws(function () { C.splitExport([['a']], 14); }, /header expected on row 15/); });

console.log('value worksheet');
t('mode A scrap with shell share', function () {
  var r = C.computeValue({ mode: 'A', parts: 100000, scrapPct: 10, shellShare: 50, reductionPct: 20, costLow: 100, costHigh: 200 });
  near(r.recoveredParts, 1000); near(r.drivers.scrap.lo, 100000); near(r.drivers.scrap.hi, 200000);
});
t('mode B uses shell share', function () { near(C.computeValue({ mode: 'B', scrapDollars: 1e6, shellShare: 40, reductionPct: 25 }).drivers.scrap.lo, 100000); });
t('revenue only when capacity constrained', function () {
  var base = { mode: 'A', parts: 100000, scrapPct: 10, shellShare: 50, reductionPct: 20, costLow: 100, priceLow: 500, vcPct: 60 };
  near(C.computeValue(base).drivers.revenue.lo, 0);
  base.capacityConstrained = true; near(C.computeValue(base).drivers.revenue.lo, 1000 * 500 * 0.4);
});
t('labor uses reduction %', function () {
  var r = C.computeValue({ tanks: 4, readsPerDay: 6, minsPerReading: 10, daysPerYear: 250, laborRate: 40, laborReductionPct: 50 });
  near(r.drivers.labor.lo, 4 * 6 * 10 / 60 * 250 * 40 * 0.5);
});
t('safety uses incidents/yr', function () { near(C.computeValue({ incidentsYear: 2, costPerIncident: 10000, safetyReductionPct: 50 }).drivers.safety.lo, 10000); });
t('out of range input rejected and zeroed', function () {
  var r = C.computeValue({ mode: 'B', scrapDollars: 1e6, shellShare: 150, reductionPct: 20 });
  assert.ok(r.errors.shellShare); near(r.drivers.scrap.lo, 0); assert.ok(r.warnings.length);
});
t('invalid VC% zeroes revenue (no inflation)', function () {
  var r = C.computeValue({ mode: 'A', parts: 100000, scrapPct: 10, shellShare: 50, reductionPct: 20, costLow: 100, capacityConstrained: true, priceLow: 500, vcPct: 150 });
  near(r.drivers.revenue.lo, 0); assert.ok(r.drivers.revenue.invalid); near(r.drivers.scrap.lo, 100000);
});
t('negative rejected', function () { assert.ok(C.validateValueInputs({ tanks: -1 }).tanks); });
t('totals sum drivers', function () {
  var r = C.computeValue({ mode: 'B', scrapDollars: 1e6, shellShare: 50, reductionPct: 10, incidentsYear: 1, costPerIncident: 1000, safetyReductionPct: 100 });
  near(r.total.lo, 51000); near(r.total.hi, 51000);
});

console.log('slurry');
t('7667 interpolation', function () { near(C.dose7667(25), 7.75); near(C.dose7667(0), 7); near(C.dose7667(150), 10); });
t('water only is SG 1', function () { var r = C.slurryRecipe({ binder: null, waterLb: 83.45, refs: [] }); near(r.sg, 1); near(r.volumeGal, 10); });
t('None refractory with weight ignored + warned', function () {
  var r = C.slurryRecipe({ binder: null, waterLb: 83.45, refs: [{ name: 'None', sg: 0, lb: 50 }] });
  near(r.totalLb, 83.45); assert.ok(r.warnings.length);
});
t('zircon mass balance', function () {
  var r = C.slurryRecipe({ binder: null, waterLb: 83.45, refs: [{ name: 'Zircon', sg: 4.6, lb: 4.6 * 83.45, isZircon: true }], wetting: true });
  near(r.volumeGal, 20); near(r.sg, (83.45 + 4.6 * 83.45) / (20 * 8.345)); near(r.pctZircon, 100); near(r.total7667Ml, 10 * 10);
});
t('polymer solids fraction input', function () {
  var a = C.slurryRecipe({ binder: null, waterLb: 50, polymerLb: 50, polymerSolidsPct: 50, refs: [] });
  var b = C.slurryRecipe({ binder: null, waterLb: 50, polymerLb: 50, polymerSolidsPct: 20, refs: [] });
  near(a.pctSolids, 25); near(b.pctSolids, 10); near(b.pctPolymerInLiquid, 10);
});
t('binder silica definition', function () {
  var r = C.slurryRecipe({ binder: { solids: 30, density: 1.2, poly: 0 }, binderLb: 100, waterLb: 50, refs: [] });
  near(r.pctSilicaInLiquid, 20);
});

console.log('tank rpm');
t('48 in @ 80 m/min = 20.89 rpm', function () { near(C.tankRpm(48, 80), 80 / (Math.PI * 48 * 0.0254)); near(C.tankRpm(48, 80), 20.89, 0.01); });
t('invalid -> null', function () { assert.strictEqual(C.tankRpm(0, 80), null); assert.strictEqual(C.tankRpm(48, -1), null); });

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
