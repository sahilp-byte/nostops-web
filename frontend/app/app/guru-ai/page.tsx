import type { Metadata } from 'next';
import { getGuruHistory, getGuruSession } from '@/lib/server/guru-ai';
import GuruAiChat from '@/components/app/learner/GuruAiChat';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Ask GuruAI',
  robots: { index: false, follow: false },
};

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default async function GuruAiPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const sessionId = one(sp.s);
  const [history, messages] = await Promise.all([
    getGuruHistory(12),
    sessionId ? getGuruSession(sessionId) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Ask GuruAI</h1>
        <p className="mt-2 text-ink-soft">Your personal yoga & wellbeing guide — powered by NOSTOPS.</p>
      </header>
      <div className="mt-6">
        <GuruAiChat initialMessages={messages} initialSessionId={sessionId || null} history={history} />
      </div>
    </div>
  );
}
