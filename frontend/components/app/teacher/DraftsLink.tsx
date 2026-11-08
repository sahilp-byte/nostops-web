'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { listDrafts } from '@/lib/retreat-drafts';

// Small client badge on the retreats list linking to the Drafts page. Renders
// nothing until it knows the (localStorage-only) draft count, so there's no
// server/client mismatch.
export default function DraftsLink() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    setCount(listDrafts().length);
  }, []);

  if (!count) return null;

  return (
    <Link href="/app/teacher/retreats/drafts" className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-cream" data-testid="drafts-link">
      Drafts ({count})
    </Link>
  );
}
