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

console.log('slurry solver (4 components)');
// Hand-checked case. Binder 30 % solids, SG 1.2, no polymer; polymer 50 % solids SG 1.0; flour SG 2.5.
// 40 B + 50 W + 10 P + 100 R: liquid 100 lb; vol-eq = 33.333 + 50 + 10 + 40 = 133.333 lb; mass 200
// -> SG 1.500; solids (12 + 5 + 100)/200 = 58.5 %; silica 12/100 = 12 %; polymer 5/200 = 2.5 % of whole slurry (5 % of liquid).
var BND = { solids: 30, density: 1.2, poly: 0 }, MAT = { binder: BND, refSG: 2.5, polymerSolidsPct: 50, polymerSG: 1.0 };
function withM(o) { var r = {}; for (var k in MAT) r[k] = MAT[k]; for (var j in o) r[j] = o[j]; return r; }
var liqP = function (B, W, P, R) { return C.slurryRecipe({ binder: BND, binderLb: B, waterLb: W, polymerLb: P, polymerSolidsPct: 50, polymerSG: 1, refs: [{ name: 'F', sg: 2.5, lb: R }] }); };
t('hand case: recipe-card definitions match (SG 1.5, 58.5 % solids, 12 % silica, 2.5 % polymer of slurry)', function () {
  var r = liqP(40, 50, 10, 100); near(r.sg, 1.5, 1e-9); near(r.pctSolids, 58.5, 1e-9); near(r.pctSilicaInLiquid, 12, 1e-9); near(r.pctPolymer, 2.5, 1e-9); near(r.pctPolymerInLiquid, 5, 1e-9);
});
t('hand case: decompose 200 lb, SG 1.5, 58.5 % solids, 2.5 % polymer -> 40/50/10/100', function () {
  var d = C.slurryDecompose(MAT, 200, 1.5, 58.5, 2.5);
  near(d.binderLb, 40, 1e-6); near(d.waterLb, 50, 1e-6); near(d.polymerLb, 10, 1e-6); near(d.flourLb, 100, 1e-6);
});
t('hand case: target fractions for SG 1.5 / 12 % silica / 2.5 % polymer = 0.20/0.25/0.05/0.50', function () {
  var f = C.targetFractions(MAT, 1.5, 12, 2.5); near(f[0], 0.2, 1e-9); near(f[1], 0.25, 1e-9); near(f[2], 0.05, 1e-9); near(f[3], 0.5, 1e-9);
});
t('SG includes polymer solids: same flour/silica, more polymer changes SG', function () {
  var a = liqP(40, 60, 0, 100), b = liqP(40, 50, 10, 100);
  assert.ok(Math.abs(a.sg - b.sg) < 1e-12); // polymer SG 1.0 = water: same volume and mass
  var hv = C.slurryRecipe({ binder: BND, binderLb: 40, waterLb: 50, polymerLb: 10, polymerSolidsPct: 50, polymerSG: 1.1, refs: [{ name: 'F', sg: 2.5, lb: 100 }] });
  assert.ok(hv.sg > b.sg);
});
t('rebuild 100 gal: hand amounts and cross-check with slurryRecipe', function () {
  var r = C.slurryRebuild(withM({ volumeGal: 100, targetSG: 1.5, targetSilicaPct: 12, targetPolymerPct: 2.5 }));
  assert.ok(r.ok); var M = 100 * 8.345 * 1.5; // 1251.75 lb
  near(r.binderLb, 0.2 * M, 1e-6); near(r.waterLb, 0.25 * M, 1e-6); near(r.polymerLb, 0.05 * M, 1e-6); near(r.flourLb, 0.5 * M, 1e-6);
  var x = liqP(r.binderLb, r.waterLb, r.polymerLb, r.flourLb);
  near(x.sg, 1.5, 1e-9); near(x.pctSilicaInLiquid, 12, 1e-9); near(x.pctPolymer, 2.5, 1e-9); near(x.pctPolymerInLiquid, 5, 1e-9); near(x.volumeGal, 100, 1e-9);
});
t('adjust: low polymer tank -> add exactly 10 lb polymer', function () {
  // current 40 B + 50 W + 0 P + 100 R (polymer 0 %); target = 40/50/10/100 composition.
  // Hand: 40/0.2 = 200, 50/0.25 = 200, 100/0.5 = 200 -> final 200 lb, add P = 10 lb only... but polymer replaces no water:
  // final 40/50/10/100 = 200 lb. Current mass 190 lb.
  var cur = liqP(40, 50, 0, 100);
  var r = C.slurryAdjust(withM({ current: { massLb: 190, sg: cur.sg, solidsPct: cur.pctSolids, polymerPct: 0 }, targetSG: 1.5, targetSilicaPct: 12, targetPolymerPct: 2.5 }));
  assert.ok(r.ok, JSON.stringify(r.errors)); near(r.addPolymerLb, 10, 1e-6); near(r.addBinderLb, 0, 1e-6); near(r.addWaterLb, 0, 1e-6); near(r.addFlourLb, 0, 1e-6);
  near(r.result.pctPolymer, 2.5, 1e-9);
});
t('adjust: thin slurry -> add 50 lb flour', function () {
  var cur = liqP(40, 50, 10, 50);
  var r = C.slurryAdjust(withM({ current: { massLb: 150, sg: cur.sg, solidsPct: cur.pctSolids, polymerPct: cur.pctPolymer }, targetSG: 1.5, targetSilicaPct: 12, targetPolymerPct: 2.5 }));
  near(r.addFlourLb, 50, 1e-6); near(r.addBinderLb + r.addWaterLb + r.addPolymerLb, 0, 1e-6); near(r.result.sg, 1.5, 1e-9);
});
t('adjust: thick slurry -> add 20 B + 25 W + 5 P', function () {
  var cur = liqP(20, 25, 5, 100);
  var r = C.slurryAdjust(withM({ current: { massLb: 150, sg: cur.sg, solidsPct: cur.pctSolids, polymerPct: cur.pctPolymer }, targetSG: 1.5, targetSilicaPct: 12, targetPolymerPct: 2.5 }));
  near(r.addBinderLb, 20, 1e-6); near(r.addWaterLb, 25, 1e-6); near(r.addPolymerLb, 5, 1e-6); near(r.addFlourLb, 0, 1e-6);
});
t('adjust: fixed final volume smaller than needed -> remove first', function () {
  var cur = liqP(20, 25, 5, 100);
  var r = C.slurryAdjust(withM({ current: { massLb: 150, sg: cur.sg, solidsPct: cur.pctSolids, polymerPct: cur.pctPolymer }, targetSG: 1.5, targetSilicaPct: 12, targetPolymerPct: 2.5, targetVolumeGal: cur.volumeGal }));
  assert.ok(r.removeGal > 0 && r.warnings.length); near(r.result.volumeGal, cur.volumeGal, 1e-6); near(r.result.sg, 1.5, 1e-9); near(r.result.pctPolymer, 2.5, 1e-9);
  ['addBinderLb', 'addWaterLb', 'addPolymerLb', 'addFlourLb'].forEach(function (k) { assert.ok(r[k] >= -1e-9, k); });
});
t('adjust: tank max exceeded -> removal plan within max', function () {
  var cur = liqP(20, 25, 5, 100);
  var r = C.slurryAdjust(withM({ current: { massLb: 150, sg: cur.sg, solidsPct: cur.pctSolids, polymerPct: cur.pctPolymer }, targetSG: 1.5, targetSilicaPct: 12, targetPolymerPct: 2.5, maxVolumeGal: cur.volumeGal + 1 }));
  assert.ok(r.warnings.length && r.removeGal > 0 && r.result.volumeGal <= cur.volumeGal + 1 + 1e-6);
});
t('current % polymer is required (cannot be inferred)', function () {
  var r = C.slurryAdjust(withM({ current: { massLb: 200, sg: 1.5, solidsPct: 58.5 }, targetSG: 1.5, targetSilicaPct: 12, targetPolymerPct: 2.5 }));
  assert.ok(!r.ok && /current % polymer/.test(r.errors.join(' ')));
});
t('binder polymer counts toward % polymer (like recipe cards)', function () {
  var I = withM({ binder: { solids: 30, density: 1.2, poly: 5 } });
  var f = C.targetFractions(I, 1.5, 12, 2.5); // binder-borne polymer counts, whole-slurry basis
  var B = f[0], W = f[1], P = f[2], R = f[3], liq = B + W + P; near((B * 0.05 + P * 0.5) / (liq + R) * 100, 2.5, 1e-9); assert.ok(P < 0.05 - 1e-6); near(B * 0.3 / liq * 100, 12, 1e-9);
});
t('impossible: polymer target below binder polymer', function () { var r = C.slurryRebuild(withM({ binder: { solids: 30, density: 1.2, poly: 20 }, volumeGal: 10, targetSG: 1.5, targetSilicaPct: 12, targetPolymerPct: 1 })); assert.ok(!r.ok && /below what the binder alone brings/.test(r.errors[0])); });
t('impossible: SG below liquid-only SG', function () { var r = C.slurryRebuild(withM({ volumeGal: 10, targetSG: 1.01, targetSilicaPct: 25, targetPolymerPct: 2 })); assert.ok(!r.ok && /cannot be reached by adding flour/.test(r.errors[0])); });
t('impossible: silica above binder solids', function () { assert.ok(!C.slurryRebuild(withM({ volumeGal: 10, targetSG: 1.5, targetSilicaPct: 35, targetPolymerPct: 2 })).ok); });
t('inconsistent measurements flagged', function () { var r = C.slurryAdjust(withM({ current: { massLb: 100, sg: 2.4, solidsPct: 20, polymerPct: 2 }, targetSG: 1.5, targetSilicaPct: 12, targetPolymerPct: 2 })); assert.ok(!r.ok && /not consistent/.test(r.errors[0])); });
t('validation: missing inputs', function () { assert.ok(!C.slurryAdjust(withM({ current: {} })).ok); assert.ok(!C.slurryRebuild(withM({})).ok); });

console.log('biocide 6451');
t('1000 lb -> 681 g -> 594.76 mL (spec)', function () {
  var r = C.biocideDose({ liquid: 1000 }); assert.ok(r.ok); near(r.grams, 681, 1e-9); near(r.mL, 681 / 1.145, 1e-9); near(r.mL, 594.76, 0.005);
  near(r.mL, (0.0015 * 1000 * 454) / 1.145, 1e-9);
});
t('defaults are 0.15 %, 454 g/lb, 1.145 g/mL', function () { assert.deepStrictEqual(C.BIOCIDE_DEFAULTS, { dosePct: 0.15, gPerLb: 454, densityGmL: 1.145 }); });
t('kg uses kg × 1000 g', function () { var r = C.biocideDose({ liquid: 100, unit: 'kg' }); near(r.grams, 150); near(r.mL, 150 / 1.145); });
t('custom dose and density', function () { var r = C.biocideDose({ liquid: 1000, dosePct: 0.3, densityGmL: 1.0 }); near(r.grams, 1362); near(r.mL, 1362); });
t('validation: liquid must be > 0', function () { assert.ok(C.biocideDose({ liquid: 0 }).errors.liquid); assert.ok(C.biocideDose({ liquid: -5 }).errors.liquid); assert.ok(C.biocideDose({}).errors.liquid); });
t('validation: dose and density > 0', function () { var r = C.biocideDose({ liquid: 10, dosePct: 0, densityGmL: -1 }); assert.ok(r.errors.dosePct && r.errors.densityGmL); assert.strictEqual(r.mL, null); });

t('three tiers at 1000 lb: max 681/594.76, med 454/396.51, low 227/198.25', function () {
  var r = C.biocideTiers({ liquid: 1000 }), T = {}; r.tiers.forEach(function (x) { T[x.id] = x; });
  near(T.max.grams, 681, 1e-9); near(T.max.mL, 594.76, 0.005);
  near(T.med.grams, 454, 1e-9); near(T.med.mL, 396.51, 0.005);
  near(T.low.grams, 227, 1e-9); near(T.low.mL, 198.25, 0.005);
  assert.deepStrictEqual(r.tiers.map(function (x) { return x.pct; }), [0.15, 0.10, 0.05]);
});
t('tier defaults editable; warn when above max', function () {
  var r = C.biocideTiers({ liquid: 1000, medPct: 0.2 }); near(r.tiers[1].grams, 908); assert.ok(r.warnings.length);
});

console.log('pwa');
var ROOT = path.join(__dirname, '..');
function swList() { var src = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'); return { ver: src.match(/CACHE_VERSION = '([^']+)'/)[1], list: eval(src.match(/var PRECACHE = (\[[\s\S]*?\]);/)[1]) }; }
t('sw cache version matches CTG_VERSION', function () {
  var nav = fs.readFileSync(path.join(ROOT, 'navbar.js'), 'utf8').match(/CTG_VERSION = '(v[\d.]+)/)[1];
  assert.strictEqual(swList().ver, nav);
});
t('every page and asset is precached and exists', function () {
  var L = swList().list;
  fs.readdirSync(ROOT).filter(function (f) { return /\.html$/.test(f); }).forEach(function (f) { assert.ok(L.indexOf(f) !== -1, f + ' not precached'); });
  ['ctg.css', 'calc.js', 'navbar.js', 'print.js', 'manifest.webmanifest'].forEach(function (f) { assert.ok(L.indexOf(f) !== -1, f); });
  L.filter(function (u) { return u !== './'; }).forEach(function (u) { assert.ok(fs.existsSync(path.join(ROOT, u)), u + ' missing'); });
});
t('manifest icons exist with correct pixel sizes, incl. maskable; relative scope', function () {
  var m = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.strictEqual(m.name, 'CTG Tools'); assert.strictEqual(m.scope, './'); assert.ok(!/^\//.test(m.start_url));
  assert.ok(m.icons.some(function (i) { return i.purpose === 'maskable' && i.sizes === '512x512'; }));
  m.icons.forEach(function (i) {
    var b = fs.readFileSync(path.join(ROOT, i.src)); var w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    assert.strictEqual(w + 'x' + h, i.sizes, i.src);
  });
});
t('every page links manifest, apple-touch-icon and theme-color', function () {
  fs.readdirSync(ROOT).filter(function (f) { return /\.html$/.test(f); }).forEach(function (f) {
    var h = fs.readFileSync(path.join(ROOT, f), 'utf8');
    ['rel="manifest" href="manifest.webmanifest"', 'rel="apple-touch-icon"', 'name="theme-color"', 'src="navbar.js"'].forEach(function (x) { assert.ok(h.indexOf(x) !== -1, f + ': ' + x); });
  });
});

console.log('tank rpm');
t('48 in @ 80 m/min = 20.89 rpm', function () { near(C.tankRpm(48, 80), 80 / (Math.PI * 48 * 0.0254)); near(C.tankRpm(48, 80), 20.89, 0.01); });
t('invalid -> null', function () { assert.strictEqual(C.tankRpm(0, 80), null); assert.strictEqual(C.tankRpm(48, -1), null); });

console.log('print report');
var P = require('../print.js');
var TOOLS = { 'shell-control-correlation.html': 'correlation', 'shell-control-value-calculator.html': 'value', 'slurry-calculator.html': 'slurry', 'tank-rpm-calculator.html': 'rpm', 'biocide-calculator.html': 'biocide' };
var SAMPLE = P.buildReport({ id: 'rpm', tool: 'Tank RPM Calculator', version: 'v9', generated: 'Oct 16, 2026', customer: 'ACME <Plant 2>', site: 'Line 1', notes: 'n1' },
  [{ group: 'Tank inputs', rows: [{ label: 'Tank diameter', value: '48', unit: 'in' }, { label: 'Vp', value: '', unit: 'm/min' }] }],
  [{ title: 'Recommended RPM', html: '<div class="metrics">20.89</div>' }, { title: 'Empty', html: '' }]);
t('report: header, then inputs, then results (ordering)', function () {
  var iH = SAMPLE.indexOf('rp-head'), iIn = SAMPLE.indexOf('Inputs (as applied)'), iRow = SAMPLE.indexOf('Tank diameter'), iRes = SAMPLE.indexOf('>Results<'), iOut = SAMPLE.indexOf('20.89');
  assert.ok(iH >= 0 && iH < iIn && iIn < iRow && iRow < iRes && iRes < iOut, [iH, iIn, iRow, iRes, iOut].join(','));
});
t('report: header has CTG Tools, tool, date, version, customer/site/notes (escaped)', function () {
  ['CTG Tools', 'Tank RPM Calculator', 'Oct 16, 2026', 'v9', 'ACME &lt;Plant 2&gt;', 'Line 1', 'n1'].forEach(function (x) { assert.ok(SAMPLE.indexOf(x) !== -1, x); });
  assert.ok(SAMPLE.indexOf('<Plant 2>') === -1);
});
t('report: label + value + unit per input; blank shows a dash; empty results skipped', function () {
  assert.ok(/Tank diameter<\/td><td class="v">48<\/td><td class="u">in</.test(SAMPLE));
  assert.ok(/Vp<\/td><td class="v">—<\/td><td class="u">m\/min</.test(SAMPLE));
  assert.ok(SAMPLE.indexOf('>Empty<') === -1);
});
t('report: no inputs -> says so; no header meta block when meta blank', function () {
  var h = P.buildReport({ tool: 'X' }, [], []); assert.ok(/No inputs entered/.test(h) && h.indexOf('rp-meta') === -1);
});
t('report: unit split from labels', function () {
  assert.deepStrictEqual(P.splitUnit('Tank diameter (in)'), { label: 'Tank diameter', unit: 'in' });
  assert.deepStrictEqual(P.splitUnit('Current polymer (% of whole slurry) — required'), { label: 'Current polymer — required', unit: '% of whole slurry' });
  assert.deepStrictEqual(P.splitUnit('Binder type'), { label: 'Binder type', unit: '' });
});
t('standalone HTML report embeds CSS and forces light colours', function () {
  var d = P.standaloneHtml({ tool: 'X' }, SAMPLE); assert.ok(/^<!DOCTYPE html>/.test(d) && d.indexOf('.ctg-report{') !== -1 && /color-scheme:light/.test(d) && d.indexOf(SAMPLE) !== -1);
});
t('every tool page loads print.js and registers inputs + results with the shared module', function () {
  Object.keys(TOOLS).forEach(function (f) {
    var h = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.ok(/<script src="print.js" defer><\/script>/.test(h), f + ' print.js');
    var m = h.match(/CTGPrint\.register\(\{ id: '(\w+)'[\s\S]*?results: function/); assert.ok(m && m[1] === TOOLS[f], f + ' register');
    assert.ok(h.indexOf('window.print()') === -1 && h.indexOf('print-only') === -1, f + ' still has an ad-hoc print path');
  });
  var idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8'); assert.ok(idx.indexOf('CTGPrint.register') === -1);
});
t('print CSS: only the report prints, nav/buttons hidden', function () {
  var css = fs.readFileSync(path.join(ROOT, 'ctg.css'), 'utf8');
  assert.ok(/body\.ctg-printing > \*:not\(#ctg-report\)\{display:none !important\}/.test(css) && /#ctg-report\{display:none\}/.test(css));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
