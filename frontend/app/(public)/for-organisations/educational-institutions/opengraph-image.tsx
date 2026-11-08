import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Yoga for educational institutions · NOSTOPS';

export default function OgImage() {
  return renderSiteOg({
    eyebrow: 'FOR INSTITUTIONS',
    title: 'Yoga for Students & Faculty',
    sub: 'Focus, calm and well-being across your campus.',
    tag: 'Organisations',
    footer: 'nostops.org/for-organisations/educational-institutions',
  });
}
