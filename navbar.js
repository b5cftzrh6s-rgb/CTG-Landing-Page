/* ============================================================
   CTG Landing Page — Shared Navbar
   Single source of truth for navigation across all tools.
   ============================================================
   HOW TO USE (per HTML page):
     1) In <head>:   <script src="navbar.js" defer></script>
     2) In <body>:   <div id="navbar-container"></div>
     3) Remove any hard-coded <nav> and any navbar CSS from the page.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- 1. Link registry (edit this once for all pages) ---------- */
  var NAV_LINKS = [
  { label: 'Home', href: 'index.html' },
  { label: 'Shell Control Correlation', href: 'shell-control-correlation.html' },
  { label: 'Shell Control Value Calculator', href: 'shell-control-value-calculator.html' },
  { label: 'Slurry Calculator', href: 'slurry-calculator.html' },
  { label: 'Tank RPM', href: 'tank-rpm-calculator.html' },
  {
    label: 'E3D',
    href: 'https://e3d.ecolab.com/',
    target: '_blank',
    rel: 'noopener noreferrer'
  }
];

  var BRAND_TEXT     = 'CTG';
  var BRAND_SUBTITLE = 'Colloidal Technologies Group';
  var BRAND_HREF     = 'index.html';

  /* ---------- 2. Injected CSS — namespaced to avoid page collisions ---- */
  var CSS = [
    '.ctg-nav {',
    '  position: sticky; top: 0; z-index: 1000;',
    '  background: linear-gradient(90deg, #0a1a3a 0%, #0072ce 100%);',
    '  color: #ffffff;',
    "  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;",
    '  box-shadow: 0 2px 8px rgba(0,0,0,.25);',
    '  border-bottom: 1px solid rgba(255,255,255,.08);',
    '}',
    '.ctg-nav-inner {',
    '  max-width: 1400px; margin: 0 auto;',
    '  display: flex; align-items: center; justify-content: space-between;',
    '  padding: 12px 22px; gap: 18px;',
    '}',
    '.ctg-nav-brand {',
    '  display: flex; align-items: baseline; gap: 10px;',
    '  color: #ffffff; text-decoration: none; font-weight: 700; font-size: 18px;',
    '  letter-spacing: .02em; white-space: nowrap;',
    '}',
    '.ctg-nav-brand .sub {',
    '  color: #cfe4ff; font-weight: 400; font-size: 12.5px; letter-spacing: .05em;',
    '  text-transform: uppercase;',
    '}',
    '.ctg-nav-list {',
    '  list-style: none; padding: 0; margin: 0;',
    '  display: flex; align-items: center; gap: 4px; flex-wrap: wrap;',
    '}',
    '.ctg-nav-list a {',
    '  display: inline-block; padding: 8px 14px; border-radius: 8px;',
    '  color: rgba(255,255,255,.85); text-decoration: none;',
    '  font-size: 13.5px; font-weight: 500; letter-spacing: .01em;',
    '  transition: background .15s ease, color .15s ease;',
    '  white-space: nowrap;',
    '}',
    '.ctg-nav-list a:hover, .ctg-nav-list a:focus {',
    '  background: rgba(255,255,255,.14); color: #ffffff; outline: none;',
    '}',
    '.ctg-nav-list a.active {',
    '  background: rgba(255,255,255,.22); color: #ffffff; font-weight: 600;',
    '  box-shadow: inset 0 -2px 0 #8fd4ff;',
    '}',
    '.ctg-nav-toggle {',
    '  display: none; background: transparent; border: 1px solid rgba(255,255,255,.35);',
    '  color: #fff; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 18px;',
    '}',
    '@media (max-width: 820px) {',
    '  .ctg-nav-toggle { display: inline-block; }',
    '  .ctg-nav-list {',
    '    display: none; width: 100%; flex-direction: column; align-items: stretch;',
    '    gap: 2px; padding: 8px 0 14px 0;',
    '  }',
    '  .ctg-nav-list.open { display: flex; }',
    '  .ctg-nav-inner { flex-wrap: wrap; }',
    '  .ctg-nav-list a { padding: 10px 14px; border-radius: 6px; }',
    '}',
    '@media print { .ctg-nav { display: none !important; } }'
  ].join('\n');

  /* ---------- 3. Helpers ---------- */
  function currentPage() {
    var path = (window.location.pathname || '').split('/').pop() || 'index.html';
    return path === '' ? 'index.html' : path;
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, k)) {
          if (k === 'class') node.className = attrs[k];
          else if (k === 'text') node.textContent = attrs[k];
          else if (k === 'html') node.innerHTML = attrs[k];
          else node.setAttribute(k, attrs[k]);
        }
      }
    }
    if (children && children.length) {
      for (var i = 0; i < children.length; i++) {
        if (children[i]) node.appendChild(children[i]);
      }
    }
    return node;
  }

  function injectStyles() {
    if (document.getElementById('ctg-nav-styles')) return;
    var style = document.createElement('style');
    style.id = 'ctg-nav-styles';
    style.appendChild(document.createTextNode(CSS));
    document.head.appendChild(style);
  }

  /* ---------- 4. Build the navbar ---------- */
  function buildNav() {
    var here = currentPage();

    var nav = el('nav', { class: 'ctg-nav', role: 'navigation', 'aria-label': 'CTG Tools' });
    var inner = el('div', { class: 'ctg-nav-inner' });

    var brand = el('a', { class: 'ctg-nav-brand', href: BRAND_HREF, 'aria-label': BRAND_TEXT + ' — ' + BRAND_SUBTITLE });
    brand.appendChild(el('span', { text: BRAND_TEXT }));
    brand.appendChild(el('span', { class: 'sub', text: BRAND_SUBTITLE }));
    inner.appendChild(brand);

    var toggle = el('button', {
      class: 'ctg-nav-toggle', type: 'button',
      'aria-expanded': 'false', 'aria-controls': 'ctg-nav-list',
      'aria-label': 'Toggle navigation'
    });
    toggle.appendChild(document.createTextNode('☰'));
    inner.appendChild(toggle);

    var list = el('ul', { class: 'ctg-nav-list', id: 'ctg-nav-list' });
    for (var i = 0; i < NAV_LINKS.length; i++) {
      var link = NAV_LINKS[i];
      var isActive = !link.target && (here === link.href);
      var attrs = {
  href: link.href,
  text: link.label
};

if (link.target) attrs.target = link.target;
if (link.rel) attrs.rel = link.rel;

var a = el('a', attrs);
      if (isActive) {
        a.className = 'active';
        a.setAttribute('aria-current', 'page');
      }
      var li = el('li');
      li.appendChild(a);
      list.appendChild(li);
    }
    inner.appendChild(list);

    toggle.addEventListener('click', function () {
      var open = list.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    nav.appendChild(inner);
    return nav;
  }

  /* ---------- 5. Mount ---------- */
  function mount() {
    try {
      injectStyles();
      var container = document.getElementById('navbar-container');
      if (!container) {
        console.warn('[navbar.js] No <div id="navbar-container"></div> found on this page. Navbar was not rendered.');
        return;
      }
      container.innerHTML = '';
      container.appendChild(buildNav());
    } catch (e) {
      console.error('[navbar.js] Failed to render navbar:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
