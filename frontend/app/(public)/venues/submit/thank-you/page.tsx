import type { Metadata } from 'next';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getKit, growthOrigin, kitTokenFromEdit, type VenueKit } from '@/lib/server/venue-growth';
import WidgetInstaller from '@/components/venues/growth/WidgetInstaller';
import InvitationNote from '@/components/venues/growth/InvitationNote';
import ShareInvite from '@/components/venues/growth/ShareInvite';
import VenueQr from '@/components/venues/growth/VenueQr';
import GrowthActivity from '@/components/venues/growth/GrowthActivity';
import PosterDownloads from '@/components/venues/growth/PosterDownloads';
import EmailPreference from '@/components/venues/growth/EmailPreference';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Thank you — your venue toolkit', robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ k?: string; e?: string }> };

function whatsappMessage(kit: VenueKit): string {
  const { name, website, status } = kit.venue;
  const live = status === 'published';
  return [
    `Namaste! 🙏 Our venue, ${name}, ${live ? 'is listed on' : 'is joining'} NOSTOPS, a teacher-first yoga cooperative. Yoga teachers are warmly invited to explore our property and connect with us about hosting meaningful retreats.`,
    website ? `Explore our venue: ${website}` : '',
    `${live ? 'View our NOSTOPS listing' : 'Discover venues on NOSTOPS'}: ${kit.links.listing}`,
    `Are you a yoga teacher? Create your free professional profile: ${kit.links.join}`,
  ].filter(Boolean).join('\n\n');
}

// Hindi version of the same message (separate button). NOSTOPS, the venue name and links stay as they are.
function whatsappMessageHi(kit: VenueKit): string {
  const { name, website, status } = kit.venue;
  const live = status === 'published';
  return [
    `नमस्ते! 🙏 हमारा स्थल, ${name}, ${live ? 'NOSTOPS पर सूचीबद्ध है' : 'NOSTOPS से जुड़ रहा है'}, जो शिक्षक-प्रथम योग सहकारी संस्था है। योग शिक्षकों को हमारे स्थल को देखने और सार्थक रिट्रीट आयोजित करने के लिए हमसे जुड़ने का सादर निमंत्रण है।`,
    website ? `हमारा स्थल देखें: ${website}` : '',
    `${live ? 'NOSTOPS पर हमारी लिस्टिंग देखें' : 'NOSTOPS पर स्थल खोजें'}: ${kit.links.listing}`,
    `क्या आप योग शिक्षक हैं? अपनी निःशुल्क पेशेवर प्रोफ़ाइल बनाएँ: ${kit.links.join}`,
  ].filter(Boolean).join('\n\n');
}

const ACTIONS = [
  { n: 1, href: '#widget', title: 'Add a widget to your website', desc: 'Invite yoga teachers right from your own site.' },
  { n: 2, href: '#note', title: 'Invitation note (PDF)', desc: 'A personalised note to send or print.' },
  { n: 3, href: '#share', title: 'Share on WhatsApp or copy', desc: 'A ready-to-send message with your links.' },
];

function Section({ id, n, title, desc, children }: { id: string; n?: number; title: string; desc: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 sm:p-7" data-testid={`toolkit-${id}`}>
      <div className="flex items-start gap-3">
        {n && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-black text-white">{n}</span>}
        <div>
          <h2 className="text-lg font-black tracking-tight text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{desc}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function VenueThankYouPage({ searchParams }: Props) {
  const sp = await searchParams;
  const editToken = (sp.e || '').trim();
  if (editToken && !sp.k) {
    const k = await kitTokenFromEdit(editToken);
    if (k) redirect(`/venues/submit/thank-you?k=${encodeURIComponent(k)}`);
  }
  const token = (sp.k || '').trim();
  const { kit, error } = token ? await getKit(token, growthOrigin(await headers())) : { kit: null, error: undefined };

  if (!kit) {
    return (
      <main className="container-x mx-auto max-w-xl py-16 text-center" data-testid="toolkit-invalid">
        <p className="text-4xl" aria-hidden>⏳</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-ink">This toolkit link has expired</h1>
        <p className="mt-2 text-ink-soft">{error || 'Toolkit links last 30 days.'} Request a secure link to your submission and open your toolkit from there.</p>
        <Link href="/venues/submit/edit" className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600">Get a fresh link</Link>
      </main>
    );
  }

  const published = kit.venue.status === 'published';
  return (
    <main className="pb-20" data-testid="venue-toolkit">
      <div className="border-b border-line bg-gradient-to-br from-brand-50 to-cream">
        <div className="container-x py-10 md:py-14">
          <p className="text-4xl" aria-hidden>🙏</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight text-ink md:text-4xl" data-testid="toolkit-title">
            {published ? `Thank you — ${kit.venue.name} is live on NOSTOPS` : `Thank you — ${kit.venue.name} is with our team`}
          </h1>
          <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-brand-700 ring-1 ring-brand/20" data-testid="toolkit-status">{kit.venue.status_label}</p>
          <p className="mt-4 max-w-2xl text-ink-soft">
            {published
              ? 'Your venue is discoverable by yoga teachers and seekers. Want more teachers to find you? These free tools help.'
              : 'We review every venue before it becomes discoverable, and we\u2019ll email you about each step. Meanwhile, these free tools help yoga teachers find you.'}
          </p>
        </div>
      </div>

      <div className="container-x mt-8">
        <div className="rounded-2xl border border-brand/15 bg-brand-50/40 p-5">
          <p className="text-sm font-black uppercase tracking-wide text-brand-700">Grow with NOSTOPS · optional and free</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {ACTIONS.map((a) => (
              <a key={a.n} href={a.href} className="flex min-h-[48px] gap-3 rounded-xl border border-line bg-white p-4 transition hover:border-brand" data-testid={`toolkit-action-${a.n}`}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-black text-white">{a.n}</span>
                <span>
                  <span className="block text-sm font-extrabold text-ink">{a.title}</span>
                  <span className="block text-xs text-ink-soft">{a.desc}</span>
                </span>
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-soft">No payments, commissions or paid tiers. Use as much or as little as you like.</p>
        </div>
      </div>

      <div className="container-x mt-8 grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Section id="widget" n={1} title="Add a widget to your website" desc="Choose a widget, check the preview, then copy the code once.">
            <WidgetInstaller code={kit.code} scriptUrl={kit.links.script} published={published} />
          </Section>
          <Section id="note" n={2} title="Your invitation note" desc="A personalised note for yoga teachers. View it, download it as a PDF in English or Hindi, or copy it.">
            <InvitationNote lines={kit.note} linesHi={kit.note_hi || []} token={token} />
          </Section>
          <Section id="share" n={3} title="Share on WhatsApp or copy" desc="Send it to teachers you know, your groups or your mailing list — in English or Hindi.">
            <ShareInvite message={whatsappMessage(kit)} messageHi={whatsappMessageHi(kit)} />
          </Section>
          <Section id="qr" title="Your venue QR code and posters" desc="One code that never changes — keep it on printed material.">
            <VenueQr url={kit.links.listing} code={kit.code} published={published} />
            <PosterDownloads token={token} />
          </Section>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6">
          <GrowthActivity counts={kit.counts} badge={kit.badge} widget={kit.widget} published={published} />
          <EmailPreference token={token} kind="kit" initialEnabled={kit.monthly?.enabled !== false} widgetOnOwnSite={!!kit.monthly?.widget_on_own_site} />
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-sm font-extrabold text-ink">Keep this page</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-soft">Bookmark it to come back to your toolkit and counts. The link works for 30 days, and each status email from us includes a fresh one.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
