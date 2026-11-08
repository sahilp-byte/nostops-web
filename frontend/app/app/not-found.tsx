import Link from 'next/link';

export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <h1 className="text-2xl font-black tracking-tight text-ink">Not available yet</h1>
      <p className="mt-3 text-ink-soft">This part of your workspace is coming in an upcoming release.</p>
      <Link href="/app" className="mt-6 inline-block rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">
        Back to overview
      </Link>
    </div>
  );
}
