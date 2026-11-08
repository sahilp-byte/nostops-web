import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';

export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'Yoga for startups & networking groups · NOSTOPS';

export default function OgImage() {
  return renderSiteOg({
    eyebrow: 'FOR STARTUPS & NETWORKS',
    title: 'Founder & Team Wellbeing',
    sub: 'Resilience and clarity for high-performing teams and communities.',
    tag: 'Organisations',
    footer: 'nostops.org/for-organisations/startup-networking-groups',
  });
}
