import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical, SITE_URL } from '@/lib/site';
import { JsonLd } from '@/components/JsonLd';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { normalizeJsonLd, ogImages, DEFAULT_OG_IMAGE } from '@/lib/seo';
import PageHero from '@/components/PageHero';

export const revalidate = 3600;
const CANONICAL_URL = canonical('/philosophy');

export const metadata: Metadata = {
  title: { absolute: 'Our Philosophy: What Do We Keep Alive? · NOSTOPS' },
  description:
    'The NOSTOPS philosophy — a teacher-first yoga collective rooted in the Guru–Shishya Parampara, using technology to serve the teacher–student relationship.',
  alternates: { canonical: CANONICAL_URL },
  openGraph: {
    type: 'article',
    siteName: 'NOSTOPS',
    url: CANONICAL_URL,
    title: 'The NOSTOPS Philosophy — What Do We Keep Alive?',
    description: 'Some things are not meant to be owned. They are meant to be carried.',
    images: ogImages(),
  },
  twitter: { card: 'summary_large_image', title: 'The NOSTOPS Philosophy', images: [DEFAULT_OG_IMAGE] },
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-14 text-2xl font-extrabold tracking-tight text-ink md:text-3xl">{children}</h2>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 text-lg leading-relaxed text-ink-soft">{children}</p>;
}

export default function PhilosophyPage() {
  const jsonld = normalizeJsonLd({
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'The NOSTOPS Philosophy',
    url: CANONICAL_URL,
    description: 'The full NOSTOPS philosophy — a teacher-first yoga collective rooted in the Guru–Shishya Parampara.',
    isPartOf: { '@type': 'WebSite', name: 'NOSTOPS', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'NOSTOPS', url: SITE_URL },
  });

  return (
    <div>
      <JsonLd data={jsonld} />
      <BreadcrumbJsonLd trail={[{ name: 'Home', path: '/' }, { name: 'Philosophy', path: '/philosophy' }]} />

      <PageHero
        eyebrow="About NOSTOPS"
        title="National Organisation for Software and Technology Professionals (NOSTOPS)"
        subtitle={<span className="font-semibold text-white">Some things are not meant to be owned. They are meant to be carried.</span>}
      />

      <section className="container-x py-12 md:py-16">
        <Link href="/about" className="text-sm font-bold text-brand-700 hover:underline">← Back to About</Link>

        <article className="mx-auto mt-6 max-w-3xl">
          <H2>What Do We Keep Alive?</H2>
          <P>We live in a world with more access to information than ever before — and perhaps more need for wisdom than ever before.</P>
          <P>
            NOSTOPS is a Teacher&apos;s-First Yoga Collective built around one question: what do we keep alive? A tradition. A practice.
            A value. A teacher&apos;s knowledge. A student&apos;s curiosity. The ability of one generation to leave something meaningful
            for the next.
          </P>
          <P>That question is what brings us to yoga.</P>

          <H2>From Knowledge Workers to Knowledge Custodians</H2>
          <P>
            Our founder&apos;s advocacy for Indian knowledge workers began in 2004, in the world of Indian software and technology
            professionals. For more than two decades, that work has centred on Indian knowledge workers — individuals carrying skills,
            expertise, and innovation into the global economy — and on questions of global careers, mobility, workplace rights, and
            entrepreneurship. NOSTOPS, founded in 2024, carries that same principle forward into yoga.
          </P>
          <P>That work kept raising the same questions: Who creates value? Who gets recognised for it? Who gets the chance to carry knowledge forward?</P>
          <P>
            For many years, Indian knowledge workers have travelled abroad for jobs, and Indian students have travelled abroad for
            education. With every passing decade, new technology arrived, and with it, a new wave of talented people leaving home in
            search of opportunity. Watching this pattern shift, decade after decade, raised a simple question for us: how do we build
            more of that opportunity here, at home, instead of only sending our best minds elsewhere?
          </P>
          <P>
            Over time, that question grew larger. Knowledge has value not because it exists, but because someone learns it, practises
            it, and passes it on. Yoga introduced us to another kind of knowledge carrier: the teacher. The engineer builds systems for
            the future; the teacher helps prepare a human being for it. Different worlds, same underlying question — how do we recognise
            and support the people who carry knowledge forward?
          </P>
          <P>NOSTOPS is extending that question into yoga.</P>

          <H2>Why Yoga</H2>
          <P>
            Software and yoga may seem worlds apart. But India has always been home to rich knowledge traditions, and yoga is one of its
            great living ones. It didn&apos;t survive because it was written down — it survived because people carried it: guru to
            shishya, teacher to student, generation to generation. Knowledge became practice. Practice became experience. Experience
            became wisdom, passed to those who came next.
          </P>
          <P>That living transmission is what NOSTOPS exists to support.</P>
          <P>
            No generation starts from nothing. We inherit languages, knowledge, values, and traditions we didn&apos;t create — and our
            task isn&apos;t just to hold onto that inheritance, but to understand it, practise it, and leave something of value for
            whoever comes after us.
          </P>
          <P>
            NOSTOPS isn&apos;t digitising yoga. We are using technology to support the people through whom yoga continues to live. We are
            not owners of this tradition. We are its temporary custodians.
          </P>

          <H2>The Wisdom Gap</H2>
          <P>
            Anyone can search for almost anything today. AI can explain almost anything. But access to information doesn&apos;t create
            understanding, and understanding doesn&apos;t automatically become wisdom. Knowledge tells us what. Experience teaches us how.
            Wisdom helps us discern why, when, and what matters.
          </P>
          <P>
            AI can increasingly provide information. A teacher provides context, experience, discernment, and lived transmission — not
            instead of technology, but alongside it.
          </P>
          <P>Can a world of instant answers still make room for wisdom? We believe it must.</P>

          <H2>Why We Put the Teacher First</H2>
          <P>
            A teacher is not simply someone who runs a Yoga session. Within the Guru–Shishya Parampara, a teacher is part of a living
            chain — receiving knowledge, practising it, embodying it, and passing it forward.
          </P>
          <P>
            A good teacher doesn&apos;t create dependence; the point of teaching is to help the student eventually stand on their own —
            and, one day, perhaps become a teacher too. The individual moves on. The knowledge, the practice, and the relationship
            continue. That&apos;s transmission. That&apos;s Parampara.
          </P>
          <P>
            If a teacher is treated only as a service provider, the relationship becomes transactional: session, payment, done. But if a
            teacher is recognised as a custodian of knowledge, something larger becomes possible. NOSTOPS is teacher-first not because
            teachers are the supply side of a marketplace, but because the teacher is the human carrier of the tradition — with the
            recognition, dignity, visibility, and sustainable pathways they deserve.
          </P>

          <H2>What Continues</H2>
          <P>A conventional platform asks: how many sessions happened?</P>
          <P>NOSTOPS asks something else: what continues because this relationship existed?</P>
          <P>
            The teacher teaches the student. The student becomes capable of standing independently. The student carries something forward
            — and perhaps, one day, becomes a teacher themselves. The knowledge continues beyond both.
          </P>
          <P>That is the truest measure of success we know: not what was delivered, but what endures.</P>

          <H2>A Living Tradition</H2>
          <P>
            Yoga has long carried a spirit of generosity. Much of its history involved teaching offered freely, in service rather than for
            a fee — a tradition captured in an old saying: knowledge grows when you give it away.
          </P>
          <P>
            That spirit is still visible today. In many small temple towns and villages across India — often in places far beyond the big
            cities — teachers continue in this way, teaching yoga freely, just as their own gurus taught them. It is one of the most
            enduring expressions of the Guru–Shishya relationship still alive in India.
          </P>
          <P>
            We don&apos;t believe this means yoga must always be free to be authentic. A teacher may offer knowledge freely, or make
            teaching their livelihood — neither makes them less worthy of respect. NOSTOPS wants to honour both. Whether a teacher works
            in a village or a city, whether they teach for free or for a living, they deserve the same respect, dignity, and recognition.
          </P>

          <H2>Where Technology Fits</H2>
          <P>
            NOSTOPS is a technology platform, and we believe technology can genuinely help: connecting seekers with teachers, helping
            teachers reach beyond geography, documenting knowledge, building community, and creating new economic opportunity for teachers.
          </P>
          <P>
            But technology is infrastructure. The teacher is the human centre. We can never emphasise enough the value of the Guru–Shishya
            relationship — our aim is to build technology that serves it, not replace it. The platform is not the tradition. The profile is
            not the teacher. The video is not the practice. The teacher–student connection is.
          </P>

          <H2>Yoga in the Age of AI</H2>
          <P>
            The next generation will have capabilities we could scarcely imagine — AI, instant information, global networks, new forms of
            learning and work. That&apos;s worth embracing. But capability alone doesn&apos;t tell us what&apos;s worth doing. That takes
            reflection, values, self-understanding, and sometimes the guidance of someone who has walked the path before us.
          </P>
          <P>
            Young talent will always be in demand — that demand isn&apos;t the problem. What we believe is missing is the inner work —
            building the cognitive and the nervous system intelligence needed to navigate a world being reshaped by technology and
            artificial intelligence. That inner work cannot be outsourced; it has to be built from within.
          </P>
          <P>
            This leads us to a belief we hold, and continue to test: that yoga teachers can become some of the most valuable mentors of our
            time — not only for seekers of yoga, but for knowledge workers everywhere, learning to find their footing in a rapidly changing
            world.
          </P>

          <H2>What NOSTOPS Is Building</H2>
          <P>
            NOSTOPS is building a trusted, teacher-first network connecting verified yoga teachers, seekers, organisations, and living
            traditions — creating the digital infrastructure through which knowledge can be discovered, practised, and carried forward.
          </P>
          <ul className="mt-4 space-y-3 text-lg leading-relaxed text-ink-soft">
            <li><strong className="text-ink">For teachers</strong> — visibility, recognition, professional opportunity, and sustainable livelihoods.</li>
            <li><strong className="text-ink">For seekers</strong> — a trusted way to discover teachers, practices, and meaningful learning.</li>
            <li><strong className="text-ink">For organisations</strong> — access to qualified teachers and structured yoga programmes for workplaces, educational institutions and startup founders.</li>
            <li><strong className="text-ink">For traditions</strong> — a digital home where teachers, paramparas, and practices can be discovered and carried forward.</li>
            <li><strong className="text-ink">For the world</strong> — a bridge between India&apos;s living yoga traditions and seekers everywhere.</li>
          </ul>

          <H2>A Collective Model</H2>
          <P>
            A teacher cannot sustainably carry knowledge forward if the ecosystem around them cannot sustain the teacher. That is why
            economic sustainability is part of preserving this tradition, not separate from it.
          </P>
          <P>
            For teachers, that means a path to a livelihood that doesn&apos;t depend on word-of-mouth alone — a professional presence, and
            access to seekers and organisations who are looking for exactly what they teach. For seekers, it means the confidence of
            learning from teachers who are known and trusted, rather than found by chance. For organisations, it means bringing structured,
            credible yoga practice into workplaces and institutions, with real outcomes for the people they serve.
          </P>
          <P>
            This is a collective, not simply a directory: as more teachers join, seekers gain more choice; as more organisations
            participate, teachers gain more consistent opportunity. Growth in one part of the network strengthens every other part.
          </P>

          <H2>What We Believe</H2>
          <ul className="mt-4 space-y-3 text-lg leading-relaxed text-ink-soft">
            <li>Teachers deserve dignity.</li>
            <li>Seekers deserve access to authentic learning.</li>
            <li>India&apos;s living traditions deserve to be approached with context and respect.</li>
            <li>Technology should serve human relationships, not replace them.</li>
            <li>Knowledge becomes more valuable when it&apos;s practised and passed forward.</li>
            <li>A teacher&apos;s success includes the student&apos;s independence.</li>
            <li>We inherit more than we create — and our responsibility is to leave something meaningful for the generation that follows.</li>
          </ul>

          <H2>Our Promise</H2>
          <ul className="mt-4 space-y-3 text-lg leading-relaxed text-ink-soft">
            <li>We will not measure teachers only by numbers.</li>
            <li>We will build slowly enough to build correctly.</li>
            <li>We will let technology serve the relationship, never replace it.</li>
            <li>We will keep asking the question, even when we don&apos;t have the full answer.</li>
          </ul>

          <H2>Yoga Se Kya Hoga?</H2>
          <P>Perhaps yoga will make you stronger, more flexible, more aware.</P>
          <P>Or perhaps the real question isn&apos;t what will yoga do for me — but what can I become through the practice of it.</P>
          <P>
            That answer can&apos;t be downloaded. It has to be practised, questioned, lived — and traditionally, learned through a teacher.
          </P>
          <P>
            We don&apos;t claim to have all the answers. We&apos;re building a platform that lets the questions continue: where teachers
            can be seen, seekers can discover, traditions can travel, and knowledge — practised and passed on — can outlive any one of us.
          </P>

          <div className="mt-14 rounded-3xl bg-cream px-8 py-12 text-center">
            <p className="text-2xl font-black tracking-tight text-ink">Yoga Se Kya Hoga?</p>
            <p className="mt-3 text-lg text-ink-soft">Perhaps the answer isn&apos;t ours to give. Perhaps it is for us to discover.</p>
            <p className="mt-6 text-sm font-bold uppercase tracking-wider text-brand-700">
              NOSTOPS — A Teacher&apos;s-First Yoga Collective. From Guru to Shishya. From India to the world.
            </p>
          </div>

          <div className="mt-10">
            <Link href="/about" className="text-sm font-bold text-brand-700 hover:underline">← Back to About</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
