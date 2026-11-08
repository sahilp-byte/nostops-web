import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Become a NOSTOPS Teacher';

export default function OgImage() {
  return renderSiteOg({
    eyebrow: 'TEACHERS NETWORK',
    title: 'Become a NOSTOPS Teacher',
    sub: 'Join a teacher-first yoga cooperative — your profile is always free',
    tag: 'Join free',
    tagAccent: true,
    footer: 'nostops.org/become-a-teacher',
  });
}
