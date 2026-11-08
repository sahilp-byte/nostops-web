'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBff } from '@/lib/auth-client';

/**
 * Owner/admin-only CTA shown inside the "Meet the Teacher" placeholder when a
 * teacher has NOT uploaded an intro video. Renders NOTHING for ordinary public
 * visitors and crawlers — ownership is resolved client-side via the same
 * httpOnly-session endpoint the inline profile editor uses. Routes the owner to
 * the existing authenticated video upload workflow (no duplicate flow).
 */
export default function MeetTeacherOwnerCta({ handle }: { handle: string }) {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let alive = true;
    getBff<{ handle: string | null }>('/bff/teacher/self-editor')
      .then((r) => { if (alive && r.ok && r.data?.handle && r.data.handle === handle) setIsOwner(true); })
      .catch(() => {});
    return () => { alive = false; };
  }, [handle]);

  if (!isOwner) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-sm text-ink-soft">Let students meet you before they book you.</p>
      <Link
        href="/app/teacher/profile/media"
        data-testid="add-intro-cta"
        className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-brand-600"
      >
        🎥 Add your 90-second introduction
      </Link>
    </div>
  );
}
