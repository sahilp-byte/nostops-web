import Link from 'next/link';

// Renders a Pulse author's name. When the author has a LIVE public profile we
// reward them with a link to /teachers/{handle} (their own public page — no
// student data, so anti-poaching is unaffected). Otherwise a plain name.
// Directive-free so it renders in both server and client components.
export default function AuthorName({
  name, handle, isPublic, className = '',
}: { name: string; handle?: string | null; isPublic?: boolean; className?: string }) {
  if (isPublic && handle) {
    return (
      <Link href={`/teachers/${handle}`} data-testid="pulse-author-link" className={`font-bold text-brand-700 transition hover:underline ${className}`}>
        {name}<span aria-hidden="true" className="text-[10px]"> ↗</span>
      </Link>
    );
  }
  return <span className={`font-bold text-ink-soft ${className}`}>{name}</span>;
}
