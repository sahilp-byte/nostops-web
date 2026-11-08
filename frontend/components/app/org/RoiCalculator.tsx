'use client';

import { useCallback, useEffect, useState } from 'react';

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

type Roi = {
  program_structure?: { phase?: string; batch_size?: number; sessions_per_week?: number; total_sessions?: number; session_duration?: string; includes?: string[] };
  investment?: { employees?: number; num_batches?: number; duration_months?: number; total_investment?: number; per_member_monthly?: number; per_session?: number; per_member_total?: number; total_monthly_cost?: number };
  revenue_sharing?: { model?: string; teacher_share_total?: number; platform_share_total?: number };
};

const EMP_PRESETS = [20, 50, 100, 250];
const MONTH_PRESETS = [3, 6, 12];

export default function RoiCalculator() {
  const [employees, setEmployees] = useState(50);
  const [months, setMonths] = useState(3);
  const [data, setData] = useState<Roi | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchRoi = useCallback(async (emp: number, mon: number) => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/bff/org/roi?employees=${emp}&months=${mon}`, { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Could not compute ROI.');
      setData(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not compute ROI.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoi(employees, months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inv = data?.investment;
  const prog = data?.program_structure;
  const rev = data?.revenue_sharing;

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-ink">Employees</label>
              <span className="text-sm font-black text-brand-700">{employees}</span>
            </div>
            <input type="range" min={10} max={500} step={5} value={employees} onChange={(e) => setEmployees(parseInt(e.target.value, 10))} className="mt-2 w-full accent-[#0D9488]" />
            <div className="mt-2 flex gap-2">
              {EMP_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setEmployees(p)} className={`rounded-full px-3 py-1 text-xs font-bold ${employees === p ? 'bg-brand text-white' : 'bg-cream text-ink-soft'}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-ink">Duration (months)</label>
              <span className="text-sm font-black text-brand-700">{months}</span>
            </div>
            <div className="mt-2 flex gap-2">
              {MONTH_PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setMonths(p)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${months === p ? 'bg-brand text-white' : 'bg-cream text-ink-soft'}`}>{p} mo</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => fetchRoi(employees, months)} disabled={loading} className="w-full rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
            {loading ? 'Calculating…' : 'Calculate estimate'}
          </button>
        </div>
      </section>

      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{err}</p>}

      {inv && (
        <>
          {/* Investment */}
          <section className="rounded-2xl bg-brand p-6 text-white" data-testid="roi-investment">
            <p className="text-sm font-semibold text-white/80">Total investment · {inv.duration_months} months</p>
            <p className="mt-1 text-4xl font-black tracking-tight">{inr(inv.total_investment || 0)}</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div><p className="text-lg font-black">{inv.num_batches}</p><p className="text-xs text-white/80">Batches</p></div>
              <div><p className="text-lg font-black">{inr(inv.per_member_monthly || 0)}</p><p className="text-xs text-white/80">/member/mo</p></div>
              <div><p className="text-lg font-black">{inr(inv.per_session || 0)}</p><p className="text-xs text-white/80">/session</p></div>
            </div>
          </section>

          {/* Program structure */}
          {prog && (
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-base font-extrabold text-ink">{prog.phase || 'Program structure'}</h2>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-cream px-2.5 py-1 font-bold text-ink-soft">Batch size {prog.batch_size}</span>
                <span className="rounded-full bg-cream px-2.5 py-1 font-bold text-ink-soft">{prog.sessions_per_week}/week</span>
                <span className="rounded-full bg-cream px-2.5 py-1 font-bold text-ink-soft">{prog.total_sessions} sessions</span>
                <span className="rounded-full bg-cream px-2.5 py-1 font-bold text-ink-soft">{prog.session_duration}</span>
              </div>
              {Array.isArray(prog.includes) && prog.includes.length > 0 && (
                <ul className="mt-3 space-y-2 p-0">
                  {prog.includes.map((it) => (
                    <li key={it} className="flex items-start gap-2 text-sm text-ink-soft"><span className="mt-0.5 text-brand">✓</span>{it}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Revenue sharing */}
          {rev && (
            <section className="rounded-2xl border border-line bg-white p-5">
              <h2 className="text-base font-extrabold text-ink">Where your investment goes</h2>
              <p className="mt-0.5 text-xs text-muted">Revenue-share model · {rev.model}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-brand-50/60 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">To teachers</p>
                  <p className="mt-1 text-lg font-black text-brand-700">{inr(rev.teacher_share_total || 0)}</p>
                </div>
                <div className="rounded-xl bg-cream p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Platform &amp; ops</p>
                  <p className="mt-1 text-lg font-black text-ink">{inr(rev.platform_share_total || 0)}</p>
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
