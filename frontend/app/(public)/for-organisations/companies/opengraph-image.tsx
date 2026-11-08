import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Workplace yoga for companies · NOSTOPS';

export default function OgImage() {
  return renderSiteOg({
    eyebrow: 'FOR COMPANIES',
    title: 'Workplace Yoga & Wellness',
    sub: 'Reduce burnout and build focus with verified teacher-led programmes.',
    tag: 'Organisations',
    footer: 'nostops.org/for-organisations/companies',
  });
}
