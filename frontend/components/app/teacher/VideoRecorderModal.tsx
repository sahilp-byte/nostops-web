'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 90;

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find((c) => MediaRecorder.isTypeSupported(c)) || '';
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

type Phase = 'idle' | 'ready' | 'countdown' | 'recording' | 'recorded' | 'denied' | 'error';

// In-browser intro recorder: camera + mic preview → record (≤90s) → review →
// hand a Blob back to the parent, which runs the normal Cloudinary upload.
export default function VideoRecorderModal({
  onCancel,
  onRecorded,
}: {
  onCancel: () => void;
  onRecorded: (blob: Blob, filename: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [count, setCount] = useState(3);
  const [errText, setErrText] = useState('');
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeRef = useRef<string>('');
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveRef = useRef<HTMLVideoElement | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (countRef.current) clearInterval(countRef.current);
    countRef.current = null;
  }, []);

  // Attach the live stream to the preview element whenever we're previewing.
  useEffect(() => {
    if ((phase === 'ready' || phase === 'recording' || phase === 'countdown') && liveRef.current && streamRef.current) {
      liveRef.current.srcObject = streamRef.current;
      liveRef.current.play().catch(() => {});
    }
  }, [phase]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enableCamera() {
    setErrText('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setPhase('ready');
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        setPhase('denied');
      } else if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') {
        setErrText('No camera or microphone was found on this device.');
        setPhase('error');
      } else {
        setErrText('Could not start the camera. Please try again.');
        setPhase('error');
      }
    }
  }

  function startCountdown() {
    if (!streamRef.current) return;
    setCount(3);
    setPhase('countdown');
    countRef.current = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          if (countRef.current) clearInterval(countRef.current);
          countRef.current = null;
          beginRecording();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function abortCountdown() {
    if (countRef.current) clearInterval(countRef.current);
    countRef.current = null;
    setPhase('ready');
  }

  function beginRecording() {
    if (!streamRef.current) return;
    const mime = pickMime();
    mimeRef.current = mime;
    chunksRef.current = [];
    try {
      const rec = mime ? new MediaRecorder(streamRef.current, { mimeType: mime }) : new MediaRecorder(streamRef.current);
      rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const type = mimeRef.current || 'video/webm';
        const blob = new Blob(chunksRef.current, { type });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setPhase('recorded');
      };
      recorderRef.current = rec;
      rec.start();
      setSeconds(0);
      setPhase('recording');
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) { stopRecording(); return MAX_SECONDS; }
          return s + 1;
        });
      }, 1000);
    } catch {
      setErrText('Recording is not supported in this browser. Please upload a file instead.');
      setPhase('error');
    }
  }

  function stopRecording() {
    clearTimer();
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
  }

  function reRecord() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedUrl(null);
    blobRef.current = null;
    setSeconds(0);
    setPhase('ready');
  }

  function useThis() {
    if (!blobRef.current) return;
    const ext = (mimeRef.current || '').includes('mp4') ? 'mp4' : 'webm';
    clearTimer();
    stopTracks();
    onRecorded(blobRef.current, `intro.${ext}`);
  }

  function cancel() {
    clearTimer();
    stopTracks();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    onCancel();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" data-testid="recorder-modal">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-extrabold text-ink">Record your intro</h3>

        {phase === 'idle' && (
          <>
            <p className="mt-1 text-sm text-muted">We&apos;ll use your camera and microphone to record a short introduction, right here in your browser. Nothing is saved until you choose to use it.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={cancel} className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">Cancel</button>
              <button type="button" onClick={enableCamera} data-testid="enable-camera-btn" className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Enable camera &amp; mic</button>
            </div>
          </>
        )}

        {phase === 'denied' && (
          <>
            <p className="mt-1 rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>
              Camera/microphone access was blocked. To record, allow access from your browser&apos;s site settings (tap the lock icon in the address bar → Permissions → allow Camera &amp; Microphone), then try again.
            </p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={cancel} className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">Close</button>
              <button type="button" onClick={enableCamera} className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Try again</button>
            </div>
          </>
        )}

        {phase === 'error' && (
          <>
            <p className="mt-1 rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>{errText}</p>
            <div className="mt-5 flex justify-end">
              <button type="button" onClick={cancel} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Close</button>
            </div>
          </>
        )}

        {(phase === 'ready' || phase === 'recording' || phase === 'countdown') && (
          <>
            <div className="relative mt-3 overflow-hidden rounded-2xl bg-black">
              <video ref={liveRef} muted playsInline autoPlay className="aspect-[3/4] w-full object-cover" />
              {phase === 'recording' && (
                <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> {fmt(seconds)} / {fmt(MAX_SECONDS)}
                </span>
              )}
              {phase === 'countdown' && (
                <div className="absolute inset-0 grid place-items-center bg-black/40" data-testid="countdown-overlay">
                  <span key={count} className="text-7xl font-black text-white drop-shadow-lg" style={{ animation: 'none' }}>{count}</span>
                  <span className="absolute bottom-6 text-sm font-bold text-white/90">Get ready…</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex gap-3">
              {phase === 'ready' && (
                <>
                  <button type="button" onClick={cancel} className="flex-1 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">Cancel</button>
                  <button type="button" onClick={startCountdown} data-testid="start-record-btn" className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700">● Start recording</button>
                </>
              )}
              {phase === 'countdown' && (
                <button type="button" onClick={abortCountdown} className="w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink-soft transition hover:bg-cream">Cancel</button>
              )}
              {phase === 'recording' && (
                <button type="button" onClick={stopRecording} data-testid="stop-record-btn" className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-bold text-white transition hover:opacity-90">■ Stop recording</button>
              )}
            </div>
          </>
        )}

        {phase === 'recorded' && recordedUrl && (
          <>
            <div className="mt-3 overflow-hidden rounded-2xl bg-black">
              <video src={recordedUrl} controls playsInline className="aspect-[3/4] w-full object-contain" />
            </div>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-sm font-bold text-ink" data-testid="clip-length">
              <span aria-hidden>⏱</span> Clip length: {fmt(seconds)}
            </p>
            {seconds < 15 && (
              <p className="mt-2 rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: '#FFFBEB', color: '#B45309' }} data-testid="short-clip-warning">
                That&apos;s a short intro ({seconds}s). Clips of at least 15 seconds let you share your style and lineage — we recommend re-recording.
              </p>
            )}
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={reRecord} data-testid="rerecord-btn" className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${seconds < 15 ? 'bg-brand text-white hover:bg-brand-600' : 'border border-line bg-white text-ink-soft hover:bg-cream'}`}>Re-record</button>
              <button type="button" onClick={useThis} data-testid="use-video-btn" className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition ${seconds < 15 ? 'border border-line bg-white text-ink-soft hover:bg-cream' : 'bg-brand text-white hover:bg-brand-600'}`}>Use this video</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
