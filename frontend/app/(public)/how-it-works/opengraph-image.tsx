import { renderSiteOg, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/site-og';

// Contextual branded card for the retreat-flywheel explainer (/how-it-works).
export const runtime = 'nodejs';
export const revalidate = 3600;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = 'How NOSTOPS works';

export default function OgImage() {
  return renderSiteOg({
    eyebrow: 'HOW IT WORKS',
    title: 'One retreat feeds the next',
    sub: 'The NOSTOPS retreat flywheel for teachers & venues',
    tag: 'The flywheel',
    footer: 'nostops.org/how-it-works',
  });
}
