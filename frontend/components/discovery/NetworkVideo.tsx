// Shared "Benefits of the NOSTOPS Empanelled Yoga Teachers Network" video.
// Used on the provisional claim page and the public claim hub. It's a plain
// iframe (no client state), so it renders in both server and client trees.
export default function NetworkVideo({
  className = '',
  maxWidthClass = 'max-w-[260px]',
  heading = 'Why join the network',
  caption = 'The benefits of being part of the Yoga Teachers Empowerment Network.',
}: {
  className?: string;
  maxWidthClass?: string;
  heading?: string;
  caption?: string;
}) {
  return (
    <aside className={className} data-testid="network-video">
      <div className="rounded-2xl border border-brand/20 bg-white p-3">
        <p className="mb-2 text-right text-[12px] font-black uppercase tracking-wide text-brand-700">
          {heading}
        </p>
        <div className={`relative ml-auto aspect-[9/16] w-full ${maxWidthClass} overflow-hidden rounded-xl border border-line bg-black`}>
          <iframe
            src="https://www.youtube-nocookie.com/embed/DmnDDttCoRU?rel=0&playsinline=1"
            title="Benefits of the NOSTOPS Empanelled Yoga Teachers Network"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <p className="mt-2 text-right text-[11px] leading-snug text-ink-soft">
          {caption}
        </p>
      </div>
    </aside>
  );
}
