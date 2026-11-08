'use client';

import { useEffect, useRef, useState } from 'react';

// S1 — India PIN + locality picker for NOSTOPS Spaces (Phase 2). Type a 6-digit PIN and the district,
// state and localities fill in. Spaces-only: never use this inside Global Venues forms.
export type PickedLocation = { pin: string; locality_id: string; locality: string; district: string; state: string; country: 'IN' };
type Loc = { id: string; name: string; office_type: string; taluk: string; district: string; state: string };
type Status = 'idle' | 'loading' | 'ok' | 'invalid' | 'unknown' | 'error';

const input = 'mt-1 w-full rounded-xl border border-line bg-white min-h-[48px] px-3 py-3 text-sm text-ink focus:border-brand focus:outline-none';

export default function PinLocalityPicker({ value, onChange }: { value?: PickedLocation | null; onChange: (v: PickedLocation | null) => void }) {
  const [pin, setPin] = useState(value?.pin || '');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [data, setData] = useState<{ district: string; state: string; localities: Loc[] } | null>(null);
  const [selected, setSelected] = useState(value?.locality_id || '');
  const [retry, setRetry] = useState(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    setData(null);
    if (pin.length < 6) {
      setStatus(pin && !/^[1-9]/.test(pin) ? 'invalid' : 'idle');
      setMessage(pin && !/^[1-9]/.test(pin) ? 'Indian PIN codes never start with 0.' : '');
      return;
    }
    if (!/^[1-9][0-9]{5}$/.test(pin)) {
      setStatus('invalid');
      setMessage('Enter a valid 6-digit Indian PIN code.');
      return;
    }
    const ctrl = new AbortController();
    setStatus('loading');
    fetch(`/bff/spaces/pin/${pin}`, { signal: ctrl.signal })
      .then(async (r) => ({ status: r.status, d: await r.json().catch(() => ({})) }))
      .then(({ status: s, d }) => {
        if (s === 200) {
          setData({ district: d.district, state: d.state, localities: d.localities || [] });
          setStatus('ok');
          setMessage('');
          setSelected((cur) => (d.localities?.some((l: Loc) => l.id === cur) ? cur : d.localities?.length === 1 ? d.localities[0].id : ''));
        } else {
          setStatus(s === 404 ? 'unknown' : s === 422 ? 'invalid' : 'error');
          setMessage(d.message || 'Locality lookup is unavailable right now.');
        }
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return;
        setStatus('error');
        setMessage('Locality lookup is unavailable right now.');
      });
    return () => ctrl.abort();
  }, [pin, retry]);

  useEffect(() => {
    const loc = data?.localities.find((l) => l.id === selected);
    onChangeRef.current(loc ? { pin, locality_id: loc.id, locality: loc.name, district: loc.district, state: loc.state, country: 'IN' } : null);
  }, [selected, data, pin]);

  const picked = data?.localities.find((l) => l.id === selected);

  return (
    <div className="space-y-3" data-testid="pin-locality-picker">
      <p className="rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700" data-testid="pin-india-only-note">
        NOSTOPS Spaces is available in India only (6-digit PIN code required). Outside India? List your venue on Global Venues instead.
      </p>
      <label className="block text-sm font-bold text-ink">
        PIN code
        <input
          className={input}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          placeholder="e.g. 560001"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          data-testid="pin-input"
        />
      </label>

      {status === 'loading' && <p className="text-sm text-muted" data-testid="pin-loading">Looking up this PIN code…</p>}
      {(status === 'invalid' || status === 'unknown') && (
        <p className="text-sm font-semibold text-accent-600" data-testid={`pin-${status}`}>{message}</p>
      )}
      {status === 'error' && (
        <p className="text-sm font-semibold text-accent-600" data-testid="pin-error">
          {message}{' '}
          <button type="button" className="inline-flex min-h-[44px] items-center px-2 underline" onClick={() => setRetry((n) => n + 1)} data-testid="pin-retry">Retry</button>
        </p>
      )}

      {status === 'ok' && data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-white px-3 py-2">
              <p className="text-xs font-semibold text-muted">District</p>
              <p className="text-sm font-bold text-ink" data-testid="pin-district">{picked?.district || data.district}</p>
            </div>
            <div className="rounded-xl border border-line bg-white px-3 py-2">
              <p className="text-xs font-semibold text-muted">State</p>
              <p className="text-sm font-bold text-ink" data-testid="pin-state">{picked?.state || data.state}</p>
            </div>
          </div>
          <label className="block text-sm font-bold text-ink">
            Locality <span className="font-normal text-muted">({data.localities.length} for this PIN)</span>
            <select className={input} value={selected} onChange={(e) => setSelected(e.target.value)} data-testid="locality-select">
              <option value="">Choose your locality</option>
              {data.localities.map((l) => (
                <option key={l.id} value={l.id}>{l.name}{l.taluk && l.taluk !== l.name ? ` · ${l.taluk}` : ''}</option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
}
