import Link from 'next/link';
import type { PublicSpace } from '@/lib/server/spaces';
import type { PublicTeacher } from '@/lib/teacher';
import { SPACE_MODELS, SPACE_TYPES } from '@/lib/spaces';
import { SpIcon } from '@/components/spaces/ui';

// Public cards shared by /spaces search results and /spaces/locality/[lid]. Public fields only.
export function SpaceCard({ s }: { s: PublicSpace }) {
  return (
    <Link href={`/spaces/${s.id}`} className="sp-card block overflow-hidden transition hover:-translate-y-0.5 hover:border-[#F2B574]" data-testid="space-card">
      {s.photos?.[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.photos[0]} alt={s.name || ''} className="aspect-[4/3] w-full rounded-t-[20px] object-cover" />
      ) : <div className="grid aspect-[4/3] place-items-center rounded-t-[20px] bg-[#FCF4E6] text-[#F28A1E]"><SpIcon name="building" className="h-14 w-14" /></div>}
      <div className="p-4">
        <p className="text-[19px] font-bold text-[#0F4C4A]" style={{ fontFamily: 'var(--sp-serif)' }}>{s.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] font-medium text-[#1C2A47]"><span className="text-[#F28A1E]"><SpIcon name="pin" className="h-4 w-4" /></span>{s.location?.locality}, {s.location?.district} · {s.location?.pin}</p>
        <p className="mt-3 flex flex-wrap gap-1.5 text-[12px] font-semibold">
          <span className={`rounded-full px-2.5 py-1 ${SPACE_MODELS[s.model || '']?.tone || ''}`}>{SPACE_MODELS[s.model || '']?.label}</span>
          <span className="rounded-full bg-[#FCF4E6] px-2.5 py-1 text-[#1C2A47]">{SPACE_TYPES[s.space_type || '']}</span>
          {s.capacity ? <span className="rounded-full bg-[#FCF4E6] px-2.5 py-1 text-[#1C2A47]">Up to {s.capacity} people</span> : null}
        </p>
      </div>
    </Link>
  );
}

export function TeacherCard({ t }: { t: PublicTeacher }) {
  return (
    <Link href={`/teachers/${t.handle}`} className="sp-card flex min-h-[72px] items-center gap-3 p-3 hover:border-[#F2B574]" data-testid="spaces-teacher-card">
      {t.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
      ) : <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 font-black text-brand-700">{t.name.slice(0, 1)}</div>}
      <div className="min-w-0">
        <p className="truncate font-black text-ink">{t.name}{t.isEmpanelled ? ' ✓' : ''}</p>
        <p className="truncate text-xs text-ink-soft">{[t.city, t.styles.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</p>
      </div>
    </Link>
  );
}
