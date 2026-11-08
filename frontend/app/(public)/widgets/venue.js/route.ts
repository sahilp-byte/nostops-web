// NOSTOPS Venue Partner widgets — the ONE script a venue installs, once:
//   <div class="nostops-venue-widget" data-code="CODE" data-widget="listed|teacher"></div>
//   <script src="https://www.nostops.org/widgets/venue.js" async></script>
// On every page view it fetches the CURRENT shared configuration from NOSTOPS, so a
// central admin change (wording, colours, layout, destinations) reaches every installed
// widget without the venue touching its embed code. Until the venue is published it
// shows a general NOSTOPS invitation. Rendered in a Shadow DOM with text-only content
// (textContent, validated colours/numbers/paths) — no HTML or script from configuration.
export const dynamic = 'force-static';
export const revalidate = 300;

const JS = `(function () {
  'use strict';
  if (window.NOSTOPSVenueWidget && window.NOSTOPSVenueWidget.version) { window.NOSTOPSVenueWidget.scan(); return; }
  var cs = document.currentScript || document.querySelector('script[src*="/widgets/venue.js"]');
  var base = 'https://www.nostops.org';
  try { if (cs && cs.src) base = new URL(cs.src, location.href).origin; } catch (e) {}
  var HEX = /^#[0-9A-Fa-f]{6}$/, PATH = /^\\/(?!\\/)[A-Za-z0-9\\-_\\/]{0,80}$/, CODE = /^v[a-z2-9]{9}$/;
  var SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
  var FALLBACK = {
    brand: { name: 'NOSTOPS', tagline: 'A teacher-first yoga cooperative' },
    colors: { accent: '#0F766E', text: '#1F2A2E', muted: '#5B6670', background: '#FBF8F3' },
    font: 'serif', layout: { radius: 18, max_width: 640 },
    pending: { eyebrow: 'NOSTOPS', title: 'Are You a Yoga Teacher?', body: 'NOSTOPS is a teacher-first yoga cooperative. Create your free professional profile and discover venues for your next retreat.', button: 'Discover Venues on NOSTOPS', secondary: 'Create Your Free Teacher Profile' },
    destinations: { teacher_signup: '/join', venues: '/venues' }
  };
  function str(v, d) { return typeof v === 'string' && v ? v : d; }
  function col(v, d) { return HEX.test(v || '') ? v : d; }
  function int(v, d, lo, hi) { var n = parseInt(v, 10); return n >= lo && n <= hi ? n : d; }
  function path(v, d) { return PATH.test(v || '') ? v : d; }
  function visitor() {
    try {
      var v = localStorage.getItem('nostops_wv');
      if (!v) { v = Math.random().toString(36).slice(2, 14); localStorage.setItem('nostops_wv', v); }
      return v;
    } catch (e) { return ''; }
  }
  function node(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; }
  function link(cls, text, href) { var a = node('a', cls, text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; }

  function render(host, data, kind, code) {
    var cfg = (data && data.config) || FALLBACK;
    var published = !!data && data.state === 'published';
    var copy = (published ? (kind === 'teacher' ? cfg.teacher : cfg.listed) : cfg.pending) || FALLBACK.pending;
    var c = cfg.colors || {}, lay = cfg.layout || {}, brand = cfg.brand || {}, dest = cfg.destinations || {};
    var accent = col(c.accent, '#0F766E'), ink = col(c.text, '#1F2A2E'), muted = col(c.muted, '#5B6670'), bg = col(c.background, '#FBF8F3');
    var r = int(lay.radius, 18, 0, 28), w = int(lay.max_width, 640, 320, 960);
    var ok = CODE.test(code || '');
    var main = ok ? base + '/v/' + code : base + path(dest.venues, '/venues');
    var join = ok ? base + '/v/' + code + '/join' : base + path(dest.teacher_signup, '/join');
    var root = host.shadowRoot || (host.attachShadow ? host.attachShadow({ mode: 'open' }) : host);
    while (root.firstChild) root.removeChild(root.firstChild);
    var st = document.createElement('style');
    st.textContent = ':host{display:block}' +
      '.nw{box-sizing:border-box;max-width:' + w + 'px;margin:0 auto;padding:24px;background:' + bg + ';color:' + ink + ';border:1px solid ' + accent + '33;border-radius:' + r + 'px;font-family:' + (cfg.font === 'system' ? SANS : 'Georgia,"Times New Roman",serif') + ';text-align:left}' +
      '.ey{margin:0 0 8px;font:700 12px/1.4 ' + SANS + ';letter-spacing:.14em;text-transform:uppercase;color:' + accent + '}' +
      '.ti{margin:0 0 10px;font-size:22px;line-height:1.25;font-weight:700;color:' + ink + '}' +
      '.bo{margin:0 0 18px;font-size:15px;line-height:1.6;color:' + muted + '}' +
      '.ac{display:flex;flex-wrap:wrap;gap:10px}' +
      '.bt{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 18px;box-sizing:border-box;border-radius:' + Math.min(r, 12) + 'px;font:700 14px/1.2 ' + SANS + ';text-decoration:none;border:1.5px solid ' + accent + '}' +
      '.p{background:' + accent + ';color:#FFFFFF}.s{background:transparent;color:' + accent + '}' +
      '.bt:hover{opacity:.9}.bt:focus-visible{outline:2px solid ' + accent + ';outline-offset:2px}' +
      '.ft{margin:16px 0 0;font:600 12px/1.4 ' + SANS + ';color:' + muted + '}.ft a{color:inherit;text-decoration:none}.ft a:hover{text-decoration:underline}';
    root.appendChild(st);
    var box = node('div', 'nw');
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', str(copy.title, 'NOSTOPS'));
    if (copy.eyebrow) box.appendChild(node('p', 'ey', copy.eyebrow));
    box.appendChild(node('p', 'ti', str(copy.title, 'NOSTOPS')));
    if (copy.body) box.appendChild(node('p', 'bo', copy.body));
    var acts = node('div', 'ac');
    acts.appendChild(link('bt p', str(copy.button, 'Discover NOSTOPS'), main));
    if (copy.secondary) acts.appendChild(link('bt s', copy.secondary, join));
    box.appendChild(acts);
    var ft = node('p', 'ft');
    ft.appendChild(link('', str(brand.name, 'NOSTOPS') + (brand.tagline ? ' \\u00b7 ' + brand.tagline : ''), base));
    box.appendChild(ft);
    root.appendChild(box);
    host.setAttribute('data-nostops-state', published ? 'published' : 'general');
    host.setAttribute('data-nostops-version', String((data && data.config_version) || 0));
  }

  function mount(el, code, kind) {
    code = String(code || '').toLowerCase();
    kind = kind === 'teacher' ? 'teacher' : 'listed';
    var url = base + '/bff/venue-growth/widget/' + (CODE.test(code) ? code : 'unknown') + '?v=' + encodeURIComponent(visitor()) + '&host=' + encodeURIComponent(location.hostname);
    return fetch(url, { credentials: 'omit', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { render(el, d && d.config ? d : null, kind, code); })
      .catch(function () { render(el, null, kind, code); });
  }

  function scan() {
    var nodes = document.querySelectorAll('.nostops-venue-widget');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-nostops-loaded')) continue;
      el.setAttribute('data-nostops-loaded', '1');
      mount(el, el.getAttribute('data-code'), el.getAttribute('data-widget'));
    }
  }

  window.NOSTOPSVenueWidget = { version: 1, render: render, mount: mount, scan: scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan); else scan();
})();`;

export async function GET() {
  return new Response(JS, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
      'X-Robots-Tag': 'noindex',
    },
  });
}
