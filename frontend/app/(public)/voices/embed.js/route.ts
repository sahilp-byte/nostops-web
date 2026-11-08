// Public embed loader for NOSTOPS Voices. Loaded by external publishers via
//   <div class="nostops-voices" data-slug="SLUG"></div>
//   <script src="https://www.nostops.org/voices/embed.js" async></script>
// It fetches the current article from the read-only public API (CORS-enabled)
// and injects it live — so the republished copy stays in sync with NOSTOPS.
// No NOSTOPS account is required. Attribution always travels with the content.
export const dynamic = 'force-static';
export const revalidate = 3600;

const JS = `(function () {
  var cs = document.currentScript;
  var base = 'https://www.nostops.org';
  try { base = new URL(cs.src).origin; } catch (e) {}
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function render(el, a) {
    if (!a || a.available_for_republication !== true) {
      el.innerHTML = '<p style="font:14px/1.5 system-ui,sans-serif">This article is no longer available for republication. <a href="' + esc(a && a.canonical_url ? a.canonical_url : base + '/voices') + '">Read it on NOSTOPS</a>.</p>';
      return;
    }
    var attr = a.attribution || {};
    var wrap = document.createElement('article');
    wrap.setAttribute('class', 'nostops-voices-article');
    wrap.setAttribute('style', 'max-width:720px;margin:0 auto;font:16px/1.7 Georgia,serif;color:#232a2f');
    var html = '';
    html += '<h2 style="font-family:system-ui,sans-serif;font-weight:800;line-height:1.2;color:#101418">' + esc(a.title) + '</h2>';
    html += '<p style="font-family:system-ui,sans-serif;font-size:14px;color:#5b6670;margin:-6px 0 18px">By ' + (attr.teacher_profile_url ? '<a href="' + esc(attr.teacher_profile_url) + '" style="color:#0f766e">' + esc(a.author_name) + '</a>' : esc(a.author_name)) + '</p>';
    html += '<div class="nostops-voices-body">' + (a.content_html || '') + '</div>';
    if (a.author_bio) {
      html += '<div style="margin-top:24px;padding:16px;border:1px solid #e6e6e6;border-radius:12px;font-family:system-ui,sans-serif;font-size:14px;line-height:1.6">';
      html += '<strong>About the Author</strong><br>' + esc(a.author_bio) + '</div>';
    }
    html += '<p style="margin-top:20px;font-family:system-ui,sans-serif;font-size:13px;color:#5b6670">';
    html += 'Originally published on <a href="' + esc(a.canonical_url) + '" style="color:#0f766e;font-weight:700">NOSTOPS</a>. ';
    html += '<a href="' + esc(a.canonical_url) + '" style="color:#0f766e">Original article</a>';
    if (attr.teacher_profile_url) { html += ' &middot; <a href="' + esc(attr.teacher_profile_url) + '" style="color:#0f766e">Author profile</a>'; }
    html += '</p>';
    wrap.innerHTML = html;
    el.innerHTML = '';
    el.appendChild(wrap);
  }
  var nodes = document.querySelectorAll('.nostops-voices[data-slug]');
  for (var i = 0; i < nodes.length; i++) {
    (function (el) {
      if (el.getAttribute('data-nostops-loaded')) return;
      el.setAttribute('data-nostops-loaded', '1');
      var slug = el.getAttribute('data-slug');
      fetch(base + '/api/voices/public/articles/' + encodeURIComponent(slug))
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { render(el, d && d.article); })
        .catch(function () { el.innerHTML = '<p style="font:14px/1.5 system-ui,sans-serif"><a href="' + base + '/voices">Read on NOSTOPS</a></p>'; });
    })(nodes[i]);
  }
})();`;

export async function GET() {
  return new Response(JS, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
