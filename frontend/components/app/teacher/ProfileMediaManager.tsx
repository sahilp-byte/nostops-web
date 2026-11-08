'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendBff } from '@/lib/auth-client';
import type { VideoIntro } from '@/lib/server/teacher';
import SquareImageCropper from '@/components/app/teacher/SquareImageCropper';
import VideoRecorderModal from '@/components/app/teacher/VideoRecorderModal';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CloudToken = {
  api_key: string; timestamp: number; signature: string; public_id: string;
  upload_preset: string; notification_url?: string; upload_url: string;
};

function uploadToCloudinary(file: Blob, filename: string, token: CloudToken, onProgress: (pct: number) => void, attempt = 1): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!token?.upload_url || !/^https:\/\//i.test(token.upload_url)) {
      reject(new Error('Upload could not start (bad upload URL). Please try again.'));
      return;
    }
    const form = new FormData();
    form.append('file', file, filename);
    form.append('api_key', token.api_key);
    form.append('timestamp', String(token.timestamp));
    form.append('signature', token.signature);
    form.append('public_id', token.public_id);
    form.append('upload_preset', token.upload_preset);
    if (token.notification_url) form.append('notification_url', token.notification_url);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', token.upload_url);
    xhr.timeout = 180000; // 3 min — large clips on slow mobile networks
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    const retryOr = (msg: string) => {
      // One automatic retry — most mobile upload failures are transient drops.
      if (attempt < 2) {
        onProgress(0);
        uploadToCloudinary(file, filename, token, onProgress, attempt + 1).then(resolve, reject);
      } else {
        reject(new Error(msg));
      }
    };
    xhr.onload = () => {
      try {
        const d = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(d);
        else reject(new Error(d?.error?.message || `Upload failed (error ${xhr.status}).`));
      } catch { reject(new Error(`Upload failed (error ${xhr.status || 'unknown'}).`)); }
    };
    xhr.onerror = () => retryOr('Upload failed — your connection dropped. Please check your network and try again (Wi-Fi works best for video).');
    xhr.ontimeout = () => retryOr('Upload timed out. Please try a shorter clip or a stronger connection.');
    xhr.send(form);
  });
}

function Status({ kind, text }: { kind: 'ok' | 'err' | 'info'; text: string }) {
  const color = kind === 'ok' ? 'text-brand-700' : kind === 'err' ? 'text-red-600' : 'text-muted';
  return <p className={`text-sm font-semibold ${color}`}>{text}</p>;
}

const VIDEO_STATE: Record<string, { label: string; tone: string }> = {
  approved: { label: 'Approved', tone: '#10B981' },
  pending: { label: 'Under review', tone: '#F59E0B' },
  processing: { label: 'Processing', tone: '#F59E0B' },
  upload_pending: { label: 'Awaiting upload', tone: '#94A3B8' },
  rejected: { label: 'Needs changes', tone: '#EF4444' },
  none: { label: 'Not added', tone: '#94A3B8' },
};

export default function ProfileMediaManager({ name, avatarUrl, video, onChanged }: { name: string; avatarUrl: string | null; video: VideoIntro; onChanged?: () => void }) {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const [videoBusy, setVideoBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoMsg, setVideoMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [showScript, setShowScript] = useState(false);
  const [recording, setRecording] = useState(false);
  // Holds the last recorded/selected clip so a failed upload isn't lost — the
  // teacher can retry or download it and upload manually later (e.g. on Wi‑Fi).
  const [recovery, setRecovery] = useState<{ blob: Blob; filename: string } | null>(null);

  const initial = (name || 'T').charAt(0).toUpperCase();
  const vstate = VIDEO_STATE[video.status] || VIDEO_STATE.none;
  const hasVideo = !!video.secureUrl && (video.status === 'approved' || video.status === 'pending' || video.status === 'processing');

  function onPhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoMsg({ kind: 'err', text: 'Please choose an image file.' }); return; }
    setPhotoMsg(null);
    setCropFile(file); // open the cropper
  }

  async function uploadAvatar(base64: string) {
    setCropFile(null);
    setPhotoBusy(true);
    setPhotoMsg({ kind: 'info', text: 'Saving your photo…' });
    const prev = preview;
    try {
      setPreview(base64);
      const res = await sendBff('/bff/teacher/avatar', 'POST', { base64 });
      if (!res.ok) {
        const reason =
          res.status === 0
            ? 'Upload failed — the connection dropped or the image is too large. Please try again or pick a smaller photo.'
            : res.data?.error || `Could not update your photo (error ${res.status}).`;
        throw new Error(reason);
      }
      setPhotoMsg({ kind: 'ok', text: 'Photo updated.' });
      router.refresh();
      onChanged?.();
    } catch (err) {
      setPreview(prev);
      setPhotoMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Upload failed.' });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true); setPhotoMsg(null);
    try {
      const res = await sendBff('/bff/teacher/avatar', 'DELETE');
      if (!res.ok) throw new Error(res.data?.error || 'Could not remove your photo.');
      setPreview(null);
      setPhotoMsg({ kind: 'ok', text: 'Photo removed.' });
      router.refresh();
      onChanged?.();
    } catch (err) {
      setPhotoMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Remove failed.' });
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) { setVideoMsg({ kind: 'err', text: 'Please choose a video file.' }); return; }
    if (file.size > 100 * 1024 * 1024) { setVideoMsg({ kind: 'err', text: 'Video must be under 100 MB.' }); return; }
    await uploadVideoBlob(file, file.name || 'intro.mp4');
  }

  async function onRecorded(blob: Blob, filename: string) {
    setRecording(false);
    if (blob.size > 100 * 1024 * 1024) { setVideoMsg({ kind: 'err', text: 'Recording is too large. Please record a shorter clip.' }); return; }
    await uploadVideoBlob(blob, filename);
  }

  async function uploadVideoBlob(blob: Blob, filename: string) {
    setVideoBusy(true); setProgress(0); setVideoMsg({ kind: 'info', text: 'Preparing secure upload…' });
    try {
      const tokRes = await sendBff<CloudToken & { ok: boolean; error?: string }>('/bff/teacher/video-intro', 'POST', { action: 'upload-token' });
      if (!tokRes.ok || !tokRes.data?.upload_url) throw new Error(tokRes.data?.error || 'Could not start the upload.');
      setVideoMsg({ kind: 'info', text: 'Uploading your video…' });
      await uploadToCloudinary(blob, filename, tokRes.data, setProgress);
      setVideoMsg({ kind: 'info', text: 'Processing your video…' });
      for (let i = 0; i < 8; i++) {
        await sleep(2000);
        const s = await fetch('/bff/teacher/video-intro', { credentials: 'same-origin' }).then((r) => r.json()).catch(() => null);
        const st = s?.video_intro?.status;
        if (st && st !== 'upload_pending') break;
      }
      setRecovery(null);
      setVideoMsg({ kind: 'ok', text: 'Video uploaded — our team will review it shortly.' });
      router.refresh();
      onChanged?.();
    } catch (err) {
      // Keep the clip so nothing is lost — offer retry + download instead.
      setRecovery({ blob, filename });
      setVideoMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Upload failed.' });
    } finally {
      setVideoBusy(false);
    }
  }

  function downloadRecording() {
    if (!recovery) return;
    const url = URL.createObjectURL(recovery.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = recovery.filename || 'nostops-intro-video.webm';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setVideoMsg({ kind: 'info', text: 'Saved to your device. When you have a strong Wi‑Fi connection, tap “Upload a file” and pick this video.' });
  }

  async function removeVideo() {
    setVideoBusy(true); setVideoMsg(null);
    try {
      const res = await sendBff('/bff/teacher/video-intro', 'POST', { action: 'retake' });
      if (!res.ok) throw new Error(res.data?.error || 'Could not remove the video.');
      setVideoMsg({ kind: 'ok', text: 'Video removed. You can upload a new one.' });
      router.refresh();
      onChanged?.();
    } catch (err) {
      setVideoMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Remove failed.' });
    } finally {
      setVideoBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {cropFile && <SquareImageCropper file={cropFile} onCancel={() => setCropFile(null)} onCropped={uploadAvatar} />}
      {recording && <VideoRecorderModal onCancel={() => setRecording(false)} onRecorded={onRecorded} />}

      {/* Profile photo */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="text-base font-extrabold tracking-tight text-ink">Profile photo</h2>
        <p className="mt-0.5 text-sm text-muted">A clear, friendly headshot helps learners recognise you. Square images look best.</p>
        <div className="mt-4 flex items-center gap-5">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Your profile photo" className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="grid h-24 w-24 shrink-0 place-items-center rounded-2xl bg-brand-50 text-3xl font-black text-brand-700">{initial}</span>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => photoInput.current?.click()}
              disabled={photoBusy}
              data-testid="upload-photo-btn"
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
            >
              {photoBusy ? 'Working…' : preview ? 'Replace photo' : 'Upload photo'}
            </button>
            {preview && (
              <button type="button" onClick={removePhoto} disabled={photoBusy} className="text-sm font-bold text-red-600 hover:underline disabled:opacity-60">
                Remove photo
              </button>
            )}
          </div>
          <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={onPhotoPick} />
        </div>
        {photoMsg && <div className="mt-3"><Status kind={photoMsg.kind} text={photoMsg.text} /></div>}
      </section>

      {/* Intro video */}
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold tracking-tight text-ink">Intro video</h2>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: vstate.tone }} data-testid="video-status">{vstate.label}</span>
        </div>
        <p className="mt-0.5 text-sm text-muted">Record a short 60–90 second introduction — your background, style, and who you love teaching.</p>

        {/* Tips + sample script */}
        <div className="mt-4 rounded-xl bg-cream p-4">
          <p className="text-sm font-extrabold text-ink">Tips for a great intro</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink-soft">
            <li className="flex gap-2"><span className="text-brand-600">✓</span> Face a window for soft, even light — avoid backlight.</li>
            <li className="flex gap-2"><span className="text-brand-600">✓</span> Prop your phone at eye level and hold it steady (landscape works well).</li>
            <li className="flex gap-2"><span className="text-brand-600">✓</span> Keep it to 60–90 seconds and speak warmly, as if greeting a new student.</li>
            <li className="flex gap-2"><span className="text-brand-600">✓</span> Cover: your name, your lineage/style, and who you love teaching.</li>
          </ul>
          <button type="button" onClick={() => setShowScript((s) => !s)} data-testid="script-toggle" className="mt-3 text-sm font-bold text-brand-700 hover:underline">
            {showScript ? 'Hide sample script' : 'Show a sample script'}
          </button>
          {showScript && (
            <p className="mt-2 rounded-lg border border-line bg-white p-3 text-sm italic leading-relaxed text-ink-soft" data-testid="sample-script">
              &ldquo;Namaste, I&apos;m [your name]. I&apos;ve been teaching [style, e.g. Hatha &amp; Iyengar] yoga for [X] years, rooted in the [lineage] tradition.
              I love helping [who — e.g. beginners, working professionals, seniors] build strength, calm, and steady breath.
              In my classes you can expect [what — alignment focus, breath work, gentle progression]. I&apos;d be honoured to practise with you.&rdquo;
            </p>
          )}
        </div>

        {hasVideo && video.secureUrl && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-black">
            <video src={video.secureUrl} poster={video.posterUrl || undefined} controls playsInline className="aspect-video w-full" />
          </div>
        )}

        {video.status === 'rejected' && (
          <p className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>
            Your last video needs changes{video.rejectReason ? `: ${video.rejectReason}` : '.'} Please record a new one.
          </p>
        )}

        {video.status === 'pending' && (
          <p className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold" style={{ backgroundColor: '#FFFBEB', color: '#B45309' }}>
            Your video is under review. We&apos;ll notify you once it&apos;s approved.
          </p>
        )}

        {videoBusy && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-cream">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.max(progress, 4)}%` }} />
            </div>
            <p className="mt-1 text-xs font-semibold text-muted">{progress > 0 && progress < 100 ? `Uploading ${progress}%` : 'Please wait…'}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRecording(true)}
            disabled={videoBusy}
            data-testid="record-video-btn"
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60"
          >
            🎥 Record with camera
          </button>
          <button
            type="button"
            onClick={() => videoInput.current?.click()}
            disabled={videoBusy}
            data-testid="upload-video-btn"
            className="rounded-xl border border-line bg-white px-5 py-2.5 text-sm font-bold text-ink-soft transition hover:border-brand hover:text-brand-700 disabled:opacity-60"
          >
            {hasVideo || video.status === 'rejected' ? 'Upload a file instead' : 'Upload a file'}
          </button>
          {(hasVideo || video.status === 'rejected') && (
            <button type="button" onClick={removeVideo} disabled={videoBusy} className="text-sm font-bold text-red-600 hover:underline disabled:opacity-60">
              Remove video
            </button>
          )}
          <input ref={videoInput} type="file" accept="video/*" className="hidden" onChange={onVideoPick} />
        </div>
        {recovery && !videoBusy && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4" data-testid="video-recovery">
            <p className="text-sm font-semibold text-amber-800">
              Your recording is safe on this device. You can try uploading again now, or save it and upload it later when you have strong Wi‑Fi.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => uploadVideoBlob(recovery.blob, recovery.filename)}
                data-testid="retry-upload-btn"
                className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
              >
                Try upload again
              </button>
              <button
                type="button"
                onClick={downloadRecording}
                data-testid="download-recording-btn"
                className="rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-bold text-amber-800 transition hover:bg-amber-100"
              >
                ⬇ Download recording
              </button>
            </div>
            <p className="mt-2 text-xs text-amber-700">After downloading, tap “Upload a file” above and choose the saved video.</p>
          </div>
        )}
        {videoMsg && <div className="mt-3"><Status kind={videoMsg.kind} text={videoMsg.text} /></div>}
      </section>
    </div>
  );
}
