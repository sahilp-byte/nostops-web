// /llms.txt — a plain-language guide to the site for AI assistants and answer engines (the llms.txt
// convention: a Markdown summary + the pages worth reading). Facts mirror the public pages; the
// programme and city lists are live. Crawling rules stay in /robots.txt (AI-search agents allowed,
// AI-training crawlers refused).
import { canonical } from '@/lib/site';
import { listProgrammes } from '@/lib/server/institutional';
import { getCities } from '@/lib/server/cities';
import { titleCase } from '@/lib/format';

export const revalidate = 3600;

const link = (label: string, path: string, note?: string) => `- [${label}](${canonical(path)})${note ? `: ${note}` : ''}`;

export async function GET() {
  const [catalogue, cities] = await Promise.all([listProgrammes().catch(() => null), getCities().catch(() => [])]);
  const programmes = (catalogue?.programmes || [])
    .map((p: any) => ({ slug: String(p?.slug || ''), name: String(p?.name || p?.title || ''), pathway: String(p?.taxonomy_label || '') }))
    .filter((p) => p.slug && p.name);

  const body = [
    '# NOSTOPS',
    '',
    "> NOSTOPS is India's teacher-first yoga cooperative. It connects yoga teachers with individuals, organisations and retreat venues, supported by the Council of Yoga Gurus and rooted in the Guru–Shishya Parampara. Joining is free for teachers.",
    '',
    'Key facts:',
    `- Website: ${canonical('/')}`,
    '- Who it serves: yoga teachers in India; companies, educational institutions and startup / networking groups that want yoga programmes; people looking for a yoga teacher, event or retreat.',
    '- Programmes are organised in three pathways: Mind, Body and Special Needs.',
    '- Trust labels on teacher profiles: "Verified" means the identity check passed and the teacher is empanelled; "Empanelled" and "ID Checked" are shown on their own when only one applies.',
    '- Tagline: "Yoga se kya hoga?" — healthier people, stronger organisations, happier communities and greater opportunities for yoga teachers.',
    '',
    '## For yoga teachers',
    link('Teachers Network', '/teachers', 'join and build a public teacher profile'),
    link('Claim your profile', '/claim'),
    link('Levels', '/levels', 'how teachers progress on NOSTOPS'),
    link('Become a teacher', '/become-a-teacher'),
    link('Become a City Coordinator', '/city-coordinator'),
    link('Teacher Pulse', '/teacher-pulse'),
    '',
    '## For organisations',
    link('Yoga for organisations', '/for-organisations'),
    link('Companies', '/for-organisations/companies'),
    link('Educational institutions', '/for-organisations/educational-institutions'),
    link('Startup and networking groups', '/for-organisations/startup-networking-groups'),
    link('Impact', '/for-organisations/impact'),
    link('Curated programmes', '/programmes'),
    ...programmes.map((p) => link(p.name, `/programmes/${p.slug}`, p.pathway ? `${p.pathway} pathway` : undefined)),
    '',
    '## Find teachers, events, retreats and venues',
    link('Yoga teachers by city', '/yoga-teachers'),
    ...cities.slice(0, 12).map((c) => link(`Yoga teachers in ${titleCase(c.label)}`, `/yoga-teachers/${c.slug}`)),
    link('Events', '/events'),
    link('Retreats', '/retreats'),
    link('Host a retreat', '/retreats/host'),
    link('Venues', '/venues'),
    link('List your venue', '/list-your-venue'),
    '',
    '## Yoga knowledge',
    link('Council of Yoga Gurus', '/council'),
    link('Paramparas', '/paramparas'),
    link("Yoga's living traditions", '/yoga-parampara'),
    link('Find your tradition', '/find-your-tradition'),
    link('Gurus of yoga', '/gurus'),
    link('Yoga scriptures', '/scriptures'),
    link('Guides', '/guides'),
    link('NOSTOPS Voices', '/voices'),
    '',
    '## About and trust',
    link('About NOSTOPS', '/about'),
    link('Teacher-first philosophy', '/philosophy'),
    link('How it works', '/how-it-works'),
    link('Trust and verification', '/trust'),
    link('FAQ', '/faq'),
    link('Help and support', '/support'),
    link('Contact', '/contact'),
    '',
    '## Optional',
    link('Sitemap', '/sitemap.xml'),
    link('Privacy', '/privacy'),
    link('Terms', '/terms'),
    link('Refund and cancellation', '/refunds'),
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
