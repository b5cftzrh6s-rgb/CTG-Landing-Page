/* ============================================================
   CTG shared print / report module (all tool pages).
   ------------------------------------------------------------
   Every tool page loads this file and calls
       CTGPrint.register({ id, title, inputs?, extraInputs?, results })
   - inputs():      [{ group, rows:[{label, value, unit}] }]  (default: CTGPrint.collectInputs())
   - extraInputs(): extra input groups (modes, presets, shifts...) appended after the scraped ones
   - results():     [{ title, node | nodes | html | text }]
   The module adds ONE "Print / Save PDF" button (plus "Download report (HTML)"
   and optional customer / site / notes fields) at the top of <main>, and builds
   a consolidated report: header, then INPUTS (as applied), then RESULTS.
   Printing (button or Ctrl+P) shows only the report, in a light theme.
   buildReport() is pure and is unit-tested in tests/calc.test.js.
   ============================================================ */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function blank(v) { return v == null || String(v).trim() === ''; }

  var REPORT_CSS = [
    '.ctg-report{--brand:#003a70;--brand-strong:#002a52;--accent:#c65e14;--teal:#00727e;--ok:#1f6b3a;--warn:#8a5200;--bad:#a11d1d;',
    '--bg:#fff;--surface:#fff;--surface-2:#f3f5f8;--border:#c9d1dc;--text:#000;--muted:#44505f;',
    'color:#000;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:10.5pt;line-height:1.4;color-scheme:light}',
    '.ctg-report *{box-sizing:border-box}',
    '.ctg-report .rp-head{display:flex;justify-content:space-between;gap:16px;border-bottom:3px solid #003a70;padding-bottom:8px;margin-bottom:12px}',
    '.ctg-report .rp-brand{font-weight:800;font-size:13pt;color:#003a70}.ctg-report .rp-brand small{display:block;font-weight:400;font-size:8.5pt;color:#44505f;text-transform:uppercase;letter-spacing:.06em}',
    '.ctg-report .rp-tool{text-align:right}.ctg-report .rp-tool h1{margin:0;font-size:15pt;color:#000}.ctg-report .rp-tool div{font-size:9pt;color:#44505f}',
    '.ctg-report .rp-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:4px 16px;margin:0 0 12px;font-size:9.5pt}',
    '.ctg-report .rp-meta b{color:#44505f;font-weight:600}.ctg-report .rp-notes{white-space:pre-wrap;grid-column:1/-1}',
    '.ctg-report h2.rp-sec{font-size:12pt;margin:16px 0 6px;padding:4px 8px;background:#003a70;color:#fff;border-radius:3px;break-after:avoid}',
    '.ctg-report h3{font-size:10.5pt;margin:10px 0 4px;color:#003a70;break-after:avoid}',
    '.ctg-report table.rp-in{width:100%;border-collapse:collapse;margin-bottom:6px}',
    '.ctg-report table.rp-in td{padding:3px 6px;border-bottom:1px solid #dde3ea;vertical-align:top}',
    '.ctg-report table.rp-in td.v{font-family:ui-monospace,Menlo,Consolas,monospace;text-align:right;white-space:nowrap;width:28%}',
    '.ctg-report table.rp-in td.u{color:#44505f;width:22%}',
    '.ctg-report .rp-group,.ctg-report .rp-res{break-inside:avoid-page}',
    '.ctg-report .rp-res.long{break-inside:auto}',
    '.ctg-report table{border-collapse:collapse;width:100%;font-size:9.5pt}.ctg-report thead{display:table-header-group}.ctg-report tr{break-inside:avoid}',
    '.ctg-report table.data th,.ctg-report table.data td,.ctg-report table.out td,.ctg-report table.print-comparison td,.ctg-report table.print-comparison th{padding:4px 6px;border-bottom:1px solid #dde3ea;text-align:left}',
    '.ctg-report table.data th,.ctg-report table.print-comparison th{background:#e8edf3;font-size:8.5pt;text-transform:uppercase;color:#44505f}',
    '.ctg-report td.num,.ctg-report th.num{text-align:right;font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.ctg-report tr.section-row td{background:#003a70;color:#fff;font-weight:700}',
    '.ctg-report .metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:6px}',
    '.ctg-report .metric{border:1px solid #c9d1dc;border-radius:4px;padding:6px;text-align:center;background:#f3f5f8}',
    '.ctg-report .metric .lbl{font-size:7.5pt;text-transform:uppercase;color:#44505f;font-weight:700}',
    '.ctg-report .metric .v{font-size:13pt;font-weight:800;color:#003a70;font-family:ui-monospace,Menlo,Consolas,monospace}',
    '.ctg-report .metric .u{font-size:8pt;color:#44505f}',
    '.ctg-report .metric.highlight{background:#e3ecf7;border:2px solid #003a70}.ctg-report .metric.highlight .v,.ctg-report .metric.highlight .lbl,.ctg-report .metric.highlight .u{color:#003a70;opacity:1}',
    '.ctg-report .notice{padding:5px 8px;border-left:3px solid #00727e;background:#f3f5f8;font-size:9pt;margin:5px 0}',
    '.ctg-report .notice.warn{border-left-color:#8a5200}.ctg-report .notice.bad{border-left-color:#a11d1d}.ctg-report .notice.ok{border-left-color:#1f6b3a}',
    '.ctg-report .formula{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:8.5pt;color:#333;background:#f3f5f8;padding:3px 6px;margin-top:3px}',
    '.ctg-report .grid,.ctg-report .grid-3{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}',
    '.ctg-report .card{border:1px solid #c9d1dc;border-radius:4px;padding:8px;break-inside:avoid}',
    '.ctg-report .card h3,.ctg-report .card h4{margin:0 0 4px}',
    '.ctg-report img.rp-chart{max-width:100%;height:auto;border:1px solid #c9d1dc}',
    '.ctg-report .hint{color:#44505f;font-size:8.5pt}.ctg-report .desc{color:#333;font-size:9pt}',
    '.ctg-report ul{margin:4px 0;padding-left:18px}',
    '.ctg-report .rp-foot{margin-top:14px;border-top:1px solid #c9d1dc;padding-top:4px;font-size:8pt;color:#44505f}',
    '.ctg-report .hidden{display:none}'
  ].join('\n');

  /* Pure: meta {tool, version, generated, customer, site, notes},
     inputs [{group, rows:[{label,value,unit}]}], results [{title, html}] -> HTML string.
     Inputs always come before results. */
  function buildReport(meta, inputs, results) {
    meta = meta || {};
    var h = '<div class="ctg-report" data-report-tool="' + esc(meta.id || '') + '">';
    h += '<div class="rp-head"><div class="rp-brand">CTG Tools<small>Colloidal Technologies Group</small></div>' +
      '<div class="rp-tool"><h1>' + esc(meta.tool || 'Report') + '</h1><div>' + esc(meta.generated || '') +
      (meta.version ? ' · CTG Tools ' + esc(meta.version) : '') + '</div></div></div>';
    var m = [['Customer', meta.customer], ['Site', meta.site]].filter(function (x) { return !blank(x[1]); });
    if (m.length || !blank(meta.notes)) {
      h += '<div class="rp-meta">' + m.map(function (x) { return '<div><b>' + x[0] + ':</b> ' + esc(x[1]) + '</div>'; }).join('') +
        (!blank(meta.notes) ? '<div class="rp-notes"><b>Notes:</b> ' + esc(meta.notes) + '</div>' : '') + '</div>';
    }
    h += '<section class="rp-inputs"><h2 class="rp-sec">Inputs (as applied)</h2>';
    var any = false;
    (inputs || []).forEach(function (g) {
      var rows = (g.rows || []);
      if (!rows.length) return; any = true;
      h += '<div class="rp-group">' + (g.group ? '<h3>' + esc(g.group) + '</h3>' : '') + '<table class="rp-in"><tbody>' +
        rows.map(function (r) {
          return '<tr><td class="l">' + esc(r.label) + '</td><td class="v">' + (blank(r.value) ? '—' : esc(r.value)) + '</td><td class="u">' + esc(r.unit || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    });
    if (!any) h += '<p class="desc">No inputs entered.</p>';
    h += '</section><section class="rp-results"><h2 class="rp-sec">Results</h2>';
    (results || []).forEach(function (r) {
      if (blank(r.html)) return;
      h += '<div class="rp-res' + (r.long ? ' long' : '') + '">' + (r.title ? '<h3>' + esc(r.title) + '</h3>' : '') + r.html + '</div>';
    });
    h += '</section><div class="rp-foot">Generated by CTG Tools' + (meta.version ? ' ' + esc(meta.version) : '') +
      '. Values are as entered on screen at the time of printing; confirm against site data.</div></div>';
    return h;
  }

  function standaloneHtml(meta, body) {
    return '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc((meta.tool || 'Report') + ' — CTG Tools report') + '</title><style>body{margin:24px;background:#fff}@page{margin:14mm}\n' +
      REPORT_CSS + '</style></head><body>' + body + '</body></html>';
  }

  /* ---------------- browser part ---------------- */
  var cfg = null;
  function isShown(el) {
    for (var n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentNode) {
      if (n.hidden || (n.classList && n.classList.contains('hidden'))) return false;
      var cs = window.getComputedStyle(n);
      if (cs.display === 'none' && n.tagName !== 'DETAILS') return false;
    }
    return true;
  }
  function splitUnit(label) {
    var m = label.match(/^(.*?)\s*\(([^()]*)\)\s*(.*)$/);
    if (!m) return { label: label, unit: '' };
    var rest = (m[1] + (m[3] ? ' ' + m[3] : '')).replace(/\s+/g, ' ').trim();
    return { label: rest, unit: m[2].trim() };
  }
  function controlValue(c) {
    if (c.tagName === 'SELECT') { var o = c.options[c.selectedIndex]; return o ? o.text : ''; }
    if (c.type === 'checkbox') return c.checked ? 'Yes' : 'No';
    return c.value;
  }
  function labelFor(c) {
    var l = c.id && document.querySelector('label[for="' + c.id + '"]');
    if (!l) l = c.closest('label');
    var t = l ? l.textContent : (c.getAttribute('aria-label') || c.name || c.id || '');
    if (l) { var o = l.querySelector('output'); if (o) t = t.replace(o.textContent, ''); }
    return t.replace(/\s+/g, ' ').trim();
  }
  function groupOf(c) {
    var card = c.closest('[data-report-group], section, details, .card');
    if (!card) return '';
    var title = card.getAttribute('data-report-group');
    if (!title) { var h = card.querySelector('h2, summary'); title = h ? h.textContent : (card.getAttribute('aria-label') || ''); }
    title = title.replace(/\s+/g, ' ').replace(/^\d+(?=[A-Za-z])/, '').trim();
    var subs = card.querySelectorAll('h3, .subhead'), sub = '';
    for (var i = 0; i < subs.length; i++) if (subs[i].compareDocumentPosition(c) & 4) sub = subs[i].textContent.trim();
    return title + (sub ? ' — ' + sub : '');
  }
  /* Scrape every visible, user-editable control under the roots in DOM order. */
  function collectInputs(roots, opts) {
    opts = opts || {};
    var list = [];
    (roots || ['main']).forEach(function (r) {
      var el = typeof r === 'string' ? document.querySelector(r) : r;
      if (el) list = list.concat([].slice.call(el.querySelectorAll('input, select, textarea')));
    });
    var groups = [], byName = {};
    list.forEach(function (c) {
      if (c.closest('.no-report, #ctg-report, .ctg-print-bar') || c.readOnly || c.disabled) return;
      if (/^(file|button|submit|reset|hidden|image)$/.test(c.type)) return;
      if (!isShown(c)) return;
      if (opts.skip && opts.skip(c)) return;
      var p = splitUnit(labelFor(c)), g = (opts.group && opts.group(c)) || groupOf(c);
      if (!byName[g]) { byName[g] = { group: g, rows: [] }; groups.push(byName[g]); }
      byName[g].rows.push({ label: p.label, value: controlValue(c), unit: p.unit, id: c.id });
    });
    return groups;
  }
  function nodeHtml(node) {
    if (!node) return '';
    var srcCanvas = node.tagName === 'CANVAS' ? [node] : [].slice.call(node.querySelectorAll('canvas'));
    var clone = node.cloneNode(true);
    var cc = clone.tagName === 'CANVAS' ? [clone] : [].slice.call(clone.querySelectorAll('canvas'));
    cc.forEach(function (c, i) {
      var img = document.createElement('img'); img.className = 'rp-chart';
      try { img.src = srcCanvas[i].toDataURL('image/png'); } catch (e) {}
      img.alt = srcCanvas[i].getAttribute('aria-label') || 'Chart';
      if (c === clone) clone = img; else c.parentNode.replaceChild(img, c);
    });
    if (clone.querySelectorAll) [].slice.call(clone.querySelectorAll('.no-print, .no-report, button, script')).forEach(function (n) { n.remove(); });
    [clone].concat(clone.querySelectorAll ? [].slice.call(clone.querySelectorAll('[id]')) : []).forEach(function (n) { if (n.removeAttribute) { n.removeAttribute('id'); n.removeAttribute('aria-live'); } });
    return clone.outerHTML;
  }
  function resultHtml(r) {
    if (r.html != null) return r.html;
    if (r.text != null) return blank(r.text) ? '' : '<p class="desc">' + esc(r.text) + '</p>';
    var nodes = r.nodes || (r.node ? [r.node] : []);
    return nodes.map(function (n) { n = typeof n === 'string' ? document.getElementById(n) : n; return n && isShown(n) ? nodeHtml(n) : ''; }).join('');
  }
  var META_KEY = 'ctg-report-meta';
  function metaFields() {
    var m = {};
    ['customer', 'site', 'notes'].forEach(function (k) { var e = document.getElementById('ctg-rp-' + k); m[k] = e ? e.value : ''; });
    return m;
  }
  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return { text: d.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      file: d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) };
  }
  function withLightCharts(fn) {
    var de = document.documentElement, prev = de.getAttribute('data-theme');
    var dark = prev === 'dark' || (!prev && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) { de.setAttribute('data-theme', 'light'); document.dispatchEvent(new CustomEvent('ctg-theme-change')); }
    try { return fn(); } finally {
      if (dark) { if (prev) de.setAttribute('data-theme', prev); else de.removeAttribute('data-theme'); document.dispatchEvent(new CustomEvent('ctg-theme-change')); }
    }
  }
  function build() {
    if (!cfg) return null;
    return withLightCharts(function () {
      var inputs = (cfg.inputs ? cfg.inputs() : collectInputs()).concat(cfg.extraInputs ? cfg.extraInputs() : []);
      var results = (cfg.results ? cfg.results() : []).map(function (r) { return { title: r.title, long: r.long, html: resultHtml(r) }; });
      var mf = metaFields(), st = stamp();
      var meta = { id: cfg.id, tool: cfg.title, version: root.CTG_VERSION || '', generated: st.text, customer: mf.customer, site: mf.site, notes: mf.notes };
      return { meta: meta, file: st.file, html: buildReport(meta, inputs, results), inputs: inputs, results: results };
    });
  }
  function prepare() {
    var r = build(); if (!r) return null;
    var host = document.getElementById('ctg-report');
    if (!host) { host = document.createElement('div'); host.id = 'ctg-report'; document.body.appendChild(host); }
    host.innerHTML = r.html;
    document.body.classList.add('ctg-printing');
    return r;
  }
  function cleanup() { document.body.classList.remove('ctg-printing'); }
  function print() { prepare(); window.print(); }
  function download() {
    var r = build(); if (!r) return;
    var blob = new Blob([standaloneHtml(r.meta, r.html)], { type: 'text/html' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'ctg-' + (cfg.id || 'report') + '-report-' + r.file + '.html';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function mountBar() {
    var main = document.querySelector('main'); if (!main || document.querySelector('.ctg-print-bar')) return;
    var bar = main.querySelector(':scope > .toolbar');
    if (!bar) { bar = document.createElement('div'); bar.className = 'toolbar no-print'; main.insertBefore(bar, main.firstChild); }
    bar.classList.add('ctg-print-bar');
    var b1 = document.createElement('button'); b1.type = 'button'; b1.className = 'btn'; b1.id = 'ctg-print-btn'; b1.textContent = 'Print / Save PDF';
    b1.title = 'Print a report (inputs, then results). Choose “Save as PDF” in the print dialog to save a PDF.';
    var b2 = document.createElement('button'); b2.type = 'button'; b2.className = 'btn secondary'; b2.id = 'ctg-download-btn'; b2.textContent = 'Download report (HTML)';
    b1.addEventListener('click', print); b2.addEventListener('click', download);
    bar.insertBefore(b2, bar.firstChild); bar.insertBefore(b1, b2);
    var d = document.createElement('details'); d.className = 'card no-print no-report ctg-report-meta';
    d.innerHTML = '<summary><strong>Report details (optional)</strong> <span class="hint">customer, site and notes printed in the report header</span></summary>' +
      '<div class="grid" style="margin-top:10px"><div class="field"><label for="ctg-rp-customer">Customer</label><input id="ctg-rp-customer" type="text" maxlength="120"></div>' +
      '<div class="field"><label for="ctg-rp-site">Site</label><input id="ctg-rp-site" type="text" maxlength="120"></div></div>' +
      '<div class="field"><label for="ctg-rp-notes">Notes</label><textarea id="ctg-rp-notes" rows="2" maxlength="2000" style="width:100%"></textarea></div>';
    bar.parentNode.insertBefore(d, bar.nextSibling);
    var saved = {}; try { saved = JSON.parse(localStorage.getItem(META_KEY) || '{}') || {}; } catch (e) {}
    ['customer', 'site', 'notes'].forEach(function (k) {
      var e = document.getElementById('ctg-rp-' + k); e.value = saved[k] || '';
      e.addEventListener('input', function () { try { localStorage.setItem(META_KEY, JSON.stringify(metaFields())); } catch (x) {} });
    });
  }
  function register(c) {
    cfg = c;
    if (!document.getElementById('ctg-report-css')) {
      var s = document.createElement('style'); s.id = 'ctg-report-css'; s.textContent = REPORT_CSS; document.head.appendChild(s);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountBar); else mountBar();
  }

  var api = { register: register, buildReport: buildReport, standaloneHtml: standaloneHtml, splitUnit: splitUnit, REPORT_CSS: REPORT_CSS,
    collectInputs: collectInputs, build: build, prepare: prepare, cleanup: cleanup, print: print, download: download,
    config: function () { return cfg; } };
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeprint', function () { if (cfg && !document.body.classList.contains('ctg-printing')) prepare(); });
    window.addEventListener('afterprint', cleanup);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CTGPrint = api;
})(typeof window !== 'undefined' ? window : this);
