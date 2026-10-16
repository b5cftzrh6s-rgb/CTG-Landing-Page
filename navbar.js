/* ============================================================
   CTG shared shell: tool registry, navbar, theme toggle,
   landing tiles and footer version stamp.
   ------------------------------------------------------------
   ADDING A NEW TOOL (e.g. a biocide addition calculator):
     1) Copy any tool page (e.g. tank-rpm-calculator.html) as a template:
        it already links ctg.css, calc.js, navbar.js and has
        <div id="navbar-container"></div> and <footer class="ctg-footer">.
     2) Put its pure math in calc.js and add tests in tests/calc.test.js.
     3) Add ONE entry to CTG_TOOLS below (status:'live'). The navbar and
        landing tile appear automatically. Use status:'planned' to show
        a "coming soon" tile with no link.
   ============================================================ */
(function () {
  'use strict';

  var CTG_VERSION = 'v2.3.1 · 2026-10-16';

  var CTG_TOOLS = [
    { id: 'correlation', status: 'live', nav: 'Correlation', href: 'shell-control-correlation.html', icon: '📊',
      title: 'Shell Control Correlation Tool',
      input: 'CSV export with timestamps, manual efflux-cup seconds and inline sensor cP.',
      output: 'Cup cSt → cP vs sensor fit, R², and recommended sensor LSL/USL from your cup spec.',
      when: 'Commissioning or validating a sensor against the cup test.' },
    { id: 'value', status: 'live', nav: 'Value Worksheet', href: 'shell-control-value-calculator.html', icon: '💰',
      title: 'Shell Control Value Worksheet',
      input: 'Customer plant data entered step by step: scrap, labor, slurry life, downtime, safety.',
      output: 'Annual value range with every formula and assumption printed.',
      when: 'Sitting 1-on-1 with a customer to build a defensible ROI.' },
    { id: 'slurry', status: 'live', nav: 'Slurry', href: 'slurry-calculator.html', icon: '🧪',
      title: 'Slurry Recipe Calculator',
      input: 'Recipe weights (lb), or a tank’s measured SG and % solids plus targets.',
      output: 'Volume, SG, % solids / silica / polymer, 7667 and 2305 doses; water / binder / polymer / flour additions to hit target SG, silica and polymer.',
      when: 'Designing recipes, adjusting a tank back to spec, or rebuilding a batch.' },
    { id: 'rpm', status: 'live', nav: 'Tank RPM', href: 'tank-rpm-calculator.html', icon: '⚙️',
      title: 'Tank RPM Calculator',
      input: 'Tank diameter and target tangential speed (Vp).',
      output: 'Rotation speed (RPM) for prime or backup slurry.',
      when: 'Setting up or checking slurry tank rotation.' },
    { id: 'biocide', status: 'live', nav: 'Biocide', href: 'biocide-calculator.html', icon: '🧫',
      title: 'Biocide Addition Calculator',
      input: 'Liquid weight in the tank (lb or kg).',
      output: 'Grams and mL of 6451 at Maximum (0.15 %), Medium and Low doses.',
      when: 'Making up or topping up a slurry tank and dosing biocide.' }
  ];

  var BRAND_TEXT = 'CTG', BRAND_SUBTITLE = 'Colloidal Technologies Group';

  function currentPage() {
    var p = (window.location.pathname || '').split('/').pop();
    return p || 'index.html';
  }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  /* ---------- theme ---------- */
  var THEME_KEY = 'ctg-theme';
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) {}
  function effectiveTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  var NAV_CSS = [
    '.ctg-nav{position:sticky;top:0;z-index:1000;background:linear-gradient(90deg,#071a33,#0a4a8a);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.25)}',
    '.ctg-nav-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:10px 16px;gap:12px;flex-wrap:wrap}',
    '.ctg-nav-brand{display:flex;align-items:baseline;gap:10px;color:#fff;text-decoration:none;font-weight:800;font-size:18px;white-space:nowrap}',
    '.ctg-nav-brand .sub{color:#cfe4ff;font-weight:400;font-size:12px;letter-spacing:.06em;text-transform:uppercase}',
    '.ctg-nav-list{list-style:none;padding:0;margin:0;display:flex;align-items:center;gap:2px;flex-wrap:wrap}',
    '.ctg-nav-list a,.ctg-nav-btn{display:inline-block;padding:8px 12px;border-radius:8px;color:rgba(255,255,255,.88);text-decoration:none;font-size:14px;font-weight:500;white-space:nowrap;background:transparent;border:0;cursor:pointer;font-family:inherit}',
    '.ctg-nav-list a:hover,.ctg-nav-btn:hover{background:rgba(255,255,255,.14);color:#fff}',
    '.ctg-nav-list a.active{background:rgba(255,255,255,.22);color:#fff;font-weight:700;box-shadow:inset 0 -2px 0 #8fd4ff}',
    '.ctg-nav-right{display:flex;gap:6px;align-items:center;order:2}','.ctg-nav-list{order:1;margin-left:auto!important}',
    '.ctg-nav-toggle{display:none;border:1px solid rgba(255,255,255,.35)!important}',
    '@media (max-width:860px){.ctg-nav-toggle{display:inline-block}.ctg-nav-list{display:none;width:100%;flex-direction:column;align-items:stretch;padding:6px 0 10px}.ctg-nav-list.open{display:flex}.ctg-nav-list{order:3;margin-left:0!important}.ctg-nav-list a{padding:12px}}',
    '@media print{.ctg-nav{display:none!important}}'
  ].join('\n');

  function buildNav() {
    var here = currentPage();
    var nav = el('nav', { class: 'ctg-nav', 'aria-label': 'CTG tools' });
    var inner = el('div', { class: 'ctg-nav-inner' });
    inner.appendChild(el('a', { class: 'ctg-nav-brand', href: 'index.html' },
      [el('span', { text: BRAND_TEXT }), el('span', { class: 'sub', text: BRAND_SUBTITLE })]));
    var right = el('div', { class: 'ctg-nav-right' });
    var theme = el('button', { class: 'ctg-nav-btn', type: 'button', 'aria-label': 'Toggle light/dark theme', title: 'Toggle light/dark theme' });
    function setThemeLabel() { theme.textContent = effectiveTheme() === 'dark' ? '☀️' : '🌙'; }
    setThemeLabel();
    theme.addEventListener('click', function () {
      var next = effectiveTheme() === 'dark' ? 'light' : 'dark';
      applyTheme(next); try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      setThemeLabel(); document.dispatchEvent(new CustomEvent('ctg-theme-change'));
    });
    var toggle = el('button', { class: 'ctg-nav-btn ctg-nav-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'ctg-nav-list', 'aria-label': 'Toggle navigation', text: '☰' });
    var install = el('button', { class: 'ctg-nav-btn hidden', id: 'ctg-install', type: 'button', title: 'Install CTG Tools as an app', text: '⬇ Install' });
    if (deferredInstall) install.classList.remove('hidden');
    install.addEventListener('click', function () {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function () { deferredInstall = null; install.classList.add('hidden'); });
    });
    right.appendChild(install); right.appendChild(theme); right.appendChild(toggle);
    var list = el('ul', { class: 'ctg-nav-list', id: 'ctg-nav-list' });
    var links = [{ nav: 'Home', href: 'index.html' }].concat(CTG_TOOLS.filter(function (t) { return t.status === 'live' && t.nav; }));
    links.forEach(function (t) {
      var a = el('a', { href: t.href, text: t.nav });
      if (t.external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      if (!t.external && here === t.href) { a.className = 'active'; a.setAttribute('aria-current', 'page'); }
      list.appendChild(el('li', null, [a]));
    });
    toggle.addEventListener('click', function () {
      var open = list.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    inner.appendChild(right); inner.appendChild(list);
    nav.appendChild(inner);
    return nav;
  }

  function renderTiles() {
    var host = document.getElementById('tool-tiles');
    if (!host) return;
    host.innerHTML = '';
    CTG_TOOLS.forEach(function (t) {
      var live = t.status === 'live';
      var tile = el(live ? 'a' : 'div', { class: 'tile' + (live ? '' : ' planned') });
      if (live) { tile.href = t.href; if (t.external) { tile.target = '_blank'; tile.rel = 'noopener noreferrer'; } }
      else tile.setAttribute('aria-disabled', 'true');
      tile.appendChild(el('div', { class: 'icon', 'aria-hidden': 'true', text: t.icon }));
      tile.appendChild(el('h2', { text: t.title }));
      var dl = el('dl');
      [['Input', t.input], ['Output', t.output], ['When to use', t.when]].forEach(function (p) {
        dl.appendChild(el('dt', { text: p[0] })); dl.appendChild(el('dd', { text: p[1] }));
      });
      tile.appendChild(dl);
      tile.appendChild(el('div', { class: 'go', text: live ? (t.external ? 'Open ↗' : 'Open tool →') : 'Coming soon' }));
      host.appendChild(tile);
    });
  }

  function stampFooter() {
    var f = document.querySelector('footer.ctg-footer');
    if (f && !f.querySelector('.ver')) f.appendChild(el('span', { class: 'ver', text: 'CTG Tools ' + CTG_VERSION }));
  }

  /* ---------- PWA: service worker, update prompt, install button ---------- */
  var deferredInstall = null;
  function banner(msg, btnText, onClick) {
    var b = document.getElementById('ctg-banner');
    if (!b) {
      b = el('div', { id: 'ctg-banner', role: 'status', class: 'no-print' });
      b.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:3000;background:#06223f;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.3);display:flex;gap:10px;align-items:center;font-size:14px;max-width:calc(100% - 24px)';
      document.body.appendChild(b);
    }
    b.innerHTML = '';
    b.appendChild(el('span', { text: msg }));
    if (btnText) { var x = el('button', { type: 'button', class: 'btn small', text: btnText }); x.addEventListener('click', onClick); b.appendChild(x); }
    var c = el('button', { type: 'button', class: 'btn secondary small', 'aria-label': 'Dismiss', text: '×' });
    c.addEventListener('click', function () { b.remove(); }); b.appendChild(c);
  }
  function registerSW() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    var userAskedUpdate = false, reloading = false;
    // Reload only after the user pressed "Update" (not on first install / clients.claim()).
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (!userAskedUpdate || reloading) return; reloading = true; window.location.reload(); });
    navigator.serviceWorker.register('sw.js', { scope: './' }).then(function (reg) {
      function promptUpdate(w) {
        banner('A new version of CTG Tools is available.', 'Update', function () { userAskedUpdate = true; w.postMessage('SKIP_WAITING'); });
      }
      if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () {
          if (w.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(w);
        });
      });
    }).catch(function (e) { if (window.console) console.warn('[CTG] service worker not registered:', e && e.message); });
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferredInstall = e;
    var btn = document.getElementById('ctg-install'); if (btn) btn.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', function () { deferredInstall = null; var btn = document.getElementById('ctg-install'); if (btn) btn.classList.add('hidden'); });

  function mount() {
    try {
      if (!document.getElementById('ctg-nav-styles')) {
        var s = el('style', { id: 'ctg-nav-styles' }); s.textContent = NAV_CSS; document.head.appendChild(s);
      }
      var c = document.getElementById('navbar-container');
      if (c) { c.innerHTML = ''; c.appendChild(buildNav()); }
      renderTiles(); stampFooter(); registerSW();
    } catch (e) { if (window.console) console.error('[navbar.js]', e); }
  }
  window.CTG_TOOLS = CTG_TOOLS; window.CTG_VERSION = CTG_VERSION;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
