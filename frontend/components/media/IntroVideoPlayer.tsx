'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getBff } from '@/lib/auth-client';

type Phase = 'loading' | 'ready' | 'error' | 'signin';

// Plays one intro video from the R2 library. The link comes from the BFF on demand (it expires after
// an hour); if playback fails — e.g. the link expired while the tab was open — one fresh link is
// fetched and playback resumes where the viewer was. Never autoplays. Native controls give
// pause/resume and seeking (the storage serves byte ranges).
export default function IntroVideoPlayer({
  videoId,
  title,
  className = '',
  aspectClass = 'aspect-video',
}: {
  videoId: string;
  title: string;
  className?: string;
  aspectClass?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const ref = useRef<HTMLVideoElement>(null);
  const retried = useRef(false);
  const resumeAt = useRef(0);

  const load = useCallback(async () => {
    setPhase('loading');
    const r = await getBff<{ url?: string }>(`/bff/media/intro-videos/${encodeURIComponent(videoId)}/playback`);
    if (r.ok && r.data?.url) {
      setSrc(r.data.url);
      setPhase('ready');
    } else setPhase(r.status === 401 ? 'signin' : 'error');
  }, [videoId]);

  useEffect(() => {
    retried.current = false;
    load();
  }, [load]);

  function onError() {
    if (!retried.current) {
      retried.current = true;
      resumeAt.current = ref.current?.currentTime || 0;
      load();
      return;
    }
    setPhase('error');
  }

  function onLoadedMetadata() {
    if (ref.current && resumeAt.current > 0) {
      ref.current.currentTime = resumeAt.current;
      resumeAt.current = 0;
    }
  }

  function retry() {
    retried.current = false;
    load();
  }

  return (
    <div className={`relative w-full overflow-hidden rounded-xl border border-line bg-black ${aspectClass} ${className}`} data-testid={`intro-video-${videoId}`}>
      {phase === 'ready' && src ? (
        <video
          ref={ref}
          src={src}
          title={title}
          aria-label={title}
          controls
          playsInline
          preload="metadata"
          onError={onError}
          onLoadedMetadata={onLoadedMetadata}
          className="absolute inset-0 h-full w-full object-contain"
          data-testid="intro-video-element"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-white/90" data-testid={`intro-video-${phase}`}>
          {phase === 'loading' && <p>Loading video…</p>}
          {phase === 'signin' && (
            <>
              <p>Sign in to watch this video.</p>
              <a href={`/login?next=${encodeURIComponent(typeof window === 'undefined' ? '/' : window.location.pathname)}`} className="min-h-[44px] rounded-xl bg-white px-4 py-2 font-bold text-ink">
                Sign in
              </a>
            </>
          )}
          {phase === 'error' && (
            <>
              <p>This video can&apos;t be played right now.</p>
              <button type="button" onClick={retry} className="min-h-[44px] rounded-xl bg-white px-4 py-2 font-bold text-ink" data-testid="intro-video-retry">
                Try again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
