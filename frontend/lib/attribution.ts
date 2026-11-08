// First-touch campaign attribution (client-only). On the first public page a
// visitor lands on we keep the UTM parameters, the external referrer and the
// landing path in localStorage for 30 days; the Organisation Enquiry form sends
// them with the lead so staff can see which campaign brought it in. No cookies,
// no third parties, nothing personal.
const KEY = 'nostops_attr';
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const UTM_KEYS = ['source', 'medium', 'campaign', 'term', 'content'] as const;

export type Attribution = {
  utm: Partial<Record<(typeof UTM_KEYS)[number], string>>;
  referrer: string;
  landing_page: string;
  at: number;
};

function read(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const a = JSON.parse(raw) as Attribution;
    return a && typeof a.at === 'number' && Date.now() - a.at < TTL_MS ? a : null;
  } catch {
    return null;
  }
}

export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  const utm: Attribution['utm'] = {};
  for (const k of UTM_KEYS) {
    const v = (params.get(`utm_${k}`) || '').trim().slice(0, 100);
    if (v) utm[k] = v;
  }
  const hasUtm = Object.keys(utm).length > 0;
  const existing = read();
  // First touch wins — unless the first touch carried no campaign and this one does.
  if (existing && (!hasUtm || Object.keys(existing.utm).length > 0)) return;

  let referrer = '';
  try {
    if (document.referrer && new URL(document.referrer).host !== window.location.host) referrer = document.referrer.slice(0, 300);
  } catch {
    referrer = '';
  }
  const next: Attribution = { utm, referrer, landing_page: window.location.pathname.slice(0, 300), at: Date.now() };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable (private mode) — attribution is best-effort */
  }
}

export function readAttribution(): Attribution | null {
  if (typeof window === 'undefined') return null;
  return read();
}
