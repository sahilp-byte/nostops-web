import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/server/session';
import { getMyCPApplication } from '@/lib/server/community-partners';
import CPWizard from '@/components/spaces/CPWizard';
import CPStartApplication from '@/components/spaces/CPStartApplication';
import { SpacesPageHeader } from '@/components/spaces/ui';

export const metadata: Metadata = { title: 'Community Partner application', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function CPApplyPage() {
  if (!(await getSessionUser())) redirect('/login?next=/app/spaces/partner/apply');
  // Opening this page never creates a draft: the applicant starts one explicitly (CPStartApplication → POST /mine).
  const a = await getMyCPApplication();
  if (!a) {
    return (
      <div className="mx-auto max-w-6xl" data-testid="cp-apply-start">
        <div className="space-y-4">
          <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'Community Partner Network', href: '/spaces/community-partners' }, { label: 'Application' }]}
            title="NOSTOPS Community Partner Network" image="/brand/spaces/cp-docs-hero.jpg"
            subtitle="Your application is saved as you go once you start, so you can finish it later." />
          <CPStartApplication />
        </div>
      </div>
    );
  }
  if (a.status !== 'draft' && a.status !== 'info_requested') redirect('/app/spaces/partner');
  return (
    <div className="mx-auto max-w-6xl" data-testid="cp-apply">
      <div className="space-y-4">
        <SpacesPageHeader crumbs={[{ label: 'Spaces', href: '/spaces' }, { label: 'Community Partner Network', href: '/spaces/community-partners' }, { label: 'Application' }]}
          title="NOSTOPS Community Partner Network" image="/brand/spaces/cp-docs-hero.jpg"
          subtitle={<>Application <b className="font-mono">{a.ref}</b> · saved automatically as you go.</>} />
        <CPWizard initial={a} />
      </div>
    </div>
  );
}
