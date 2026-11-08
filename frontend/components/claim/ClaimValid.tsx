'use client';

import { useState } from 'react';
import ClaimProgress from '@/components/claim/ClaimProgress';
import ClaimJourney from '@/components/claim/ClaimJourney';
import type { ClaimProfile } from '@/lib/server/teacher-claim';

// Stage 5C — valid-invitation view: the backend's own profile fields (nothing invented) + the journey.
export default function ClaimValid({ token, profile, signedIn }: { token: string; profile: ClaimProfile; signedIn: boolean }) {
  const [step, setStep] = useState(1);
  const chips = [...profile.badges, ...profile.specializations];
  return (
    <>
      <ClaimProgress done={step === 3 ? 3 : 1} />
      <div className="mt-8 rounded-2xl border border-line bg-[#FFFBF5] p-5" data-testid="claim-profile">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-xl font-bold text-brand-700" aria-hidden>{(profile.name || '?').slice(0, 1)}</span>
          )}
          <div>
            <p className="font-['SP_Serif',Georgia,serif] text-lg text-brand-700" data-testid="claim-profile-name">{profile.name || 'Your teaching profile'}</p>
            <p className="text-sm text-ink-soft">
              {[profile.city, profile.experience_years != null ? `${profile.experience_years} years teaching` : ''].filter(Boolean).join(' · ')}
            </p>
            {profile.email_masked ? <p className="text-xs text-muted">Invitation for {profile.email_masked}</p> : null}
          </div>
        </div>
        {profile.bio ? <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-ink-soft">{profile.bio}</p> : null}
        {chips.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">{chips.map((c) => <li key={c} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">{c}</li>)}</ul>
        ) : null}
        {profile.languages.length ? <p className="mt-3 text-xs text-muted">Languages: {profile.languages.join(', ')}</p> : null}
      </div>
      <div className="mt-6">
        <ClaimJourney token={token} signedIn={signedIn} onStep={setStep} />
      </div>
    </>
  );
}
