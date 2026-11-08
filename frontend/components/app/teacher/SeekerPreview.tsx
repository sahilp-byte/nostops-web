// Seeker's-eye preview of a teacher's OWN profile. Renders the same
// conversion-focused sections a seeker sees on the public /teachers/{handle}
// page, but sourced from the teacher's self-profile so it works even before the
// profile is published/live (suspended or still onboarding). Read-only, noindex.
import { inr, initials, titleCase } from '@/lib/format';
import type { TeacherSelf, Codex } from '@/lib/server/teacher';

function normalizeSocialUrl(kind: string, v?: string): string | null {
  const s = (v || '').trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  switch (kind) {
    case 'instagram': return `https://instagram.com/${s.replace(/^@/, '')}`;
    case 'youtube': return `https://youtube.com/${s.replace(/^@/, '')}`;
    case 'linkedin': return s.includes('/') ? `https://${s}` : `https://linkedin.com/in/${s}`;
    default: return `https://${s}`;
  }
}

const DIMENSION_META: Record<string, { label: string; emoji: string }> = {
  body: { label: 'Yoga for the Body', emoji: '💪' },
  mind: { label: 'Yoga for the Mind', emoji: '🧠' },
  special_needs: { label: 'Yoga for Special Needs', emoji: '❤️' },
};

function Avatar({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`${name} — NOSTOPS yoga teacher`} width={128} height={128} className="h-28 w-28 shrink-0 rounded-3xl object-cover shadow-xl ring-4 ring-white/30 md:h-32 md:w-32" />;
  }
  return (
    <div aria-hidden="true" className="grid h-28 w-28 shrink-0 place-items-center rounded-3xl bg-white/15 text-3xl font-black text-white shadow-xl ring-4 ring-white/30 backdrop-blur md:h-32 md:w-32">
      {initials(name)}
    </div>
  );
}

export default function SeekerPreview({ self, social, codex }: { self: TeacherSelf; social: Record<string, string>; codex: Codex }) {
  const specMap = new Map(codex.specializations.map((s) => [s.id, s.name]));
  const paramparaLabel = codex.paramparas.find((p) => p.id === self.parampara)?.name || (self.parampara ? titleCase(self.parampara) : undefined);
  const location = [self.city, self.country].filter(Boolean).join(', ');
  const firstName = (self.name || 'Teacher').split(' ')[0];
  const specNames = self.specializations.map((id) => specMap.get(id) || titleCase(id));
  const offerTags = [
    self.offers.online && 'Online',
    self.offers.privateSession && '1:1 Private',
    self.offers.group && 'Group classes',
    self.offers.corporate && 'Corporate',
  ].filter(Boolean) as string[];
  const socialLinks = [
    { label: 'Instagram', href: normalizeSocialUrl('instagram', social.instagram) },
    { label: 'YouTube', href: normalizeSocialUrl('youtube', social.youtube) },
    { label: 'LinkedIn', href: normalizeSocialUrl('linkedin', social.linkedin) },
    { label: 'Website', href: normalizeSocialUrl('website', social.website) },
  ].filter((s) => s.href) as Array<{ label: string; href: string }>;
  const showPremium = self.premium.enabled && !!self.premium.rateInr;

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm" data-testid="seeker-preview">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink via-royal to-brand">
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative px-6 py-10 sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Avatar name={self.name} src={self.avatarUrl} />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">{self.name}</h2>
              <p className="mt-1.5 text-base text-white/85">
                {paramparaLabel ? `${paramparaLabel} tradition` : 'Yoga Teacher'}{location ? ` · ${location}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {self.isEmpanelled && <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white shadow-sm">★ Empanelled</span>}
                {self.isVerified && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/25 backdrop-blur">✓ Verified</span>}
                {self.badgePrimary && <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/15">🎗️ {self.badgePrimary}</span>}
                {self.experienceYears ? <span className="text-sm font-semibold text-white/75">{self.experienceYears} yrs experience</span> : null}
                {self.rating ? <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-white ring-1 ring-white/15">★ {self.rating.toFixed(1)}{self.reviewsCount ? ` (${self.reviewsCount})` : ''}</span> : null}
              </div>
              {self.yogaDimensions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {self.yogaDimensions.map((d) => {
                    const m = DIMENSION_META[d] || { label: titleCase(d), emoji: '🧘' };
                    return <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white/90 ring-1 ring-white/15"><span aria-hidden="true">{m.emoji}</span> {m.label}</span>;
                  })}
                </div>
              )}
              {showPremium && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-black text-ink shadow-lg">
                  Book a session <span className="text-brand-700">· ₹{inr(self.premium.rateInr!)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-3">
        <div className="space-y-8 md:col-span-2">
          <section>
            <h3 className="text-lg font-extrabold tracking-tight text-ink">About the Teacher</h3>
            {self.bio ? (
              <p className="mt-3 whitespace-pre-line leading-relaxed text-ink-soft">{self.bio}</p>
            ) : (
              <p className="mt-3 leading-relaxed text-muted">{firstName} is a NOSTOPS teacher carrying forward a living yoga tradition. <span className="italic">Add a bio to help seekers connect with you.</span></p>
            )}
          </section>

          {(paramparaLabel || self.rootGuruName || self.lineageDeclaration) && (
            <section>
              <h3 className="text-lg font-extrabold tracking-tight text-ink">Lineage &amp; tradition</h3>
              <div className="mt-3 space-y-3 rounded-2xl border border-line bg-cream/40 p-5">
                {paramparaLabel && <p className="text-sm text-ink-soft">Parampara: <span className="font-bold text-brand-700">{paramparaLabel}</span></p>}
                {self.rootGuruName && <p className="text-sm text-ink-soft">Root Guru: <span className="font-semibold">{self.rootGuruName}</span>{self.rootGuruLocation ? ` · ${self.rootGuruLocation}` : ''}</p>}
                {self.lineageDeclaration && <p className="text-sm italic text-muted">“{self.lineageDeclaration}”</p>}
              </div>
            </section>
          )}

          {(self.styles.length > 0 || specNames.length > 0) && (
            <section>
              <h3 className="text-lg font-extrabold tracking-tight text-ink">Teaching &amp; expertise</h3>
              {self.styles.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Styles</p>
                  <div className="mt-2 flex flex-wrap gap-2">{self.styles.map((s) => <span key={s} className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink-soft">{s}</span>)}</div>
                </div>
              )}
              {specNames.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">Specialisations</p>
                  <div className="mt-2 flex flex-wrap gap-2">{specNames.map((s) => <span key={s} className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">{s}</span>)}</div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-5">
          {(showPremium || offerTags.length > 0) && (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="bg-gradient-to-br from-brand-50 to-royal-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-wider text-brand-700">Sessions</p>
                {showPremium ? (
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-ink">₹{inr(self.premium.rateInr!)}</span>
                    {self.premium.durationMin ? <span className="text-sm font-semibold text-muted">/ {self.premium.durationMin} min</span> : null}
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-ink-soft">{offerTags.length ? `Available for ${offerTags.join(', ').toLowerCase()} sessions.` : 'Session options coming soon.'}</p>
                )}
              </div>
              {offerTags.length > 0 && (
                <div className="flex flex-wrap gap-2 p-5">{offerTags.map((t) => <span key={t} className="rounded-full bg-cream px-3 py-1 text-xs font-semibold text-ink-soft">{t}</span>)}</div>
              )}
            </div>
          )}

          {self.languages.length > 0 && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Languages</p>
              <div className="mt-3 flex flex-wrap gap-2">{self.languages.map((l) => <span key={l} className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-ink-soft">{l}</span>)}</div>
            </div>
          )}

          {socialLinks.length > 0 && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Connect</p>
              <div className="mt-3 flex flex-col gap-2">
                {socialLinks.map((s) => (
                  <span key={s.label} className="flex items-center justify-between rounded-xl border border-line px-3.5 py-2.5 text-sm font-semibold text-ink-soft">
                    <span>{s.label}</span><span aria-hidden="true">↗</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
