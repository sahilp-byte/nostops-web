import { ImageResponse } from 'next/og';
import { Card, OG_SIZE, OG_CONTENT_TYPE } from '@/lib/server/parampara-og';

// Shared branded social-share card renderer for ALL public pages. Reuses the
// same gradient Card as the Council / Gurus / Paramparā / City-Coordinator
// cards, so the whole site shares one consistent OG look. This is the DEFAULT
// used by the (public) route group — every current and FUTURE public page that
// doesn't ship its own opengraph-image inherits it automatically.
export { OG_SIZE, OG_CONTENT_TYPE };

export function renderSiteOg(opts: {
  eyebrow?: string; title: string; sub?: string; tag?: string; tagAccent?: boolean; footer?: string;
}): ImageResponse {
  return new ImageResponse(
    (
      <Card
        eyebrow={opts.eyebrow || 'NOSTOPS'}
        title={opts.title}
        sub={opts.sub}
        tag={opts.tag}
        tagAccent={opts.tagAccent}
        footer={opts.footer || 'nostops.org'}
      />
    ),
    { ...OG_SIZE },
  );
}

// The generic NOSTOPS card used as the (public) group default.
export function renderDefaultSiteOg(): ImageResponse {
  return renderSiteOg({
    eyebrow: "A TEACHER'S-FIRST YOGA COOPERATIVE",
    title: 'Find your Guru. Honour the tradition.',
    sub: 'Empanelled yoga teachers, retreats & venues across India',
    tag: 'NOSTOPS',
    footer: 'nostops.org',
  });
}
