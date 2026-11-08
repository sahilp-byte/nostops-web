'use client';

import { useEffect, useState } from 'react';
import { getBff, postBff, postBffForm, sendBff } from '@/lib/auth-client';
import IntroVideoPlayer from '@/components/media/IntroVideoPlayer';

type Video = {
  id: string; title: string; description: string; content_type: string; size: number; duration_s: number | null;
  visibility: 'PRIVATE' | 'PUBLIC'; status: 'DRAFT' | 'PUBLISHED'; object_key: string; source: 'uploaded' | 'linked';
  created_at: string | null; created_by: string;
};
type BucketObject = { key: string; size: number; last_modified: string | null; in_library: boolean; managed: boolean };
type Overview = {
  settings: { configured: boolean; missing: string[]; bucket: string | null; public_domain: boolean; max_bytes: number; prefix: string; playback_ttl_s: number };
  connection: { ok: boolean; code: string | null; message: string | null };
  videos: Video[];
  bucket: { objects: BucketObject[]; truncated: boolean };
};

const BTN = 'min-h-[44px] rounded-xl border border-line bg-white px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-cream disabled:opacity-50';
const PRIMARY = 'min-h-[44px] rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50';
const INPUT = 'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink';
const VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;
const ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm';

const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(n < 1024 * 1024 ? 2 : 1)} MB`;
const dur = (s: number | null) => (s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) : '');

function Chip({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide ${on ? 'bg-emerald-50 text-emerald-700' : 'bg-cream text-ink-soft'}`}>
      {on ? onLabel : offLabel}
    </span>
  );
}

// Admin › Intro Videos — Cloudflare R2 library: storage check, upload (≤ 10 MB), read-only bucket
// listing with "add to library", preview, edit, publish / public toggles and delete.
export default function IntroVideoManager() {
  const [data, setData] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [inputKey, setInputKey] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ id: string; title: string; description: string } | null>(null);
  const [del, setDel] = useState<{ id: string; text: string } | null>(null);
  const [link, setLink] = useState<{ key: string; title: string } | null>(null);

  useEffect(() => {
    let live = true;
    getBff<Overview & { error?: string }>('/bff/admin/intro-videos').then((r) => {
      if (!live) return;
      if (r.ok) {
        setData(r.data);
        setLoadError('');
      } else setLoadError(r.data?.error || 'Could not load the video library.');
    });
    return () => { live = false; };
  }, [reload]);

  const maxBytes = data?.settings.max_bytes || 10 * 1024 * 1024;
  const ready = !!data?.connection.ok;

  function done(r: { ok: boolean; data: any }, okText: string) {
    setBusy('');
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.data?.error || 'Something went wrong.' });
    if (r.ok) setReload((n) => n + 1);
    return r.ok;
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setMsg({ ok: false, text: 'Choose a video file first.' });
    if (file.size > maxBytes) return setMsg({ ok: false, text: `That file is ${mb(file.size)} — videos can be at most ${mb(maxBytes)}.` });
    const form = new FormData();
    form.append('file', file);
    form.append('title', title);
    form.append('description', description);
    setBusy('upload');
    setMsg(null);
    const r = await postBffForm('/bff/admin/intro-videos', form);
    if (done(r, 'Uploaded. The video is Private and Draft until you publish it.')) {
      setFile(null);
      setTitle('');
      setDescription('');
      setInputKey((n) => n + 1);
    }
  }

  async function patch(v: Video, change: Partial<Pick<Video, 'title' | 'description' | 'visibility' | 'status'>>, okText: string) {
    setBusy(`patch-${v.id}`);
    setMsg(null);
    return done(await sendBff(`/bff/admin/intro-videos/${v.id}`, 'PATCH', change), okText);
  }

  async function toggleVisibility(v: Video) {
    if (v.visibility === 'PRIVATE' && !window.confirm('Make this video Public? Once it is Published, anyone on the internet can watch it without signing in.')) return;
    await patch(v, { visibility: v.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC' }, v.visibility === 'PUBLIC' ? 'Now Private — signed-in members only.' : 'Now Public.');
  }

  async function saveEdit(v: Video) {
    if (!edit) return;
    if (await patch(v, { title: edit.title, description: edit.description }, 'Saved.')) setEdit(null);
  }

  async function confirmDelete(v: Video) {
    if (!del) return;
    setBusy(`del-${v.id}`);
    setMsg(null);
    const r = await sendBff<{ object_deleted?: boolean; error?: string }>(`/bff/admin/intro-videos/${v.id}`, 'DELETE', { confirm: del.text });
    if (done(r, r.data?.object_deleted ? 'Deleted from the library and from storage.' : 'Removed from the library. The file stays in the bucket.')) setDel(null);
  }

  async function addLink() {
    if (!link) return;
    setBusy('link');
    setMsg(null);
    if (done(await postBff('/bff/admin/intro-videos/link', { key: link.key, title: link.title }), 'Added to the library as Private and Draft.')) setLink(null);
  }

  if (loadError) return <div className="mt-6 rounded-2xl border border-dashed border-line bg-cream/40 p-8 text-center text-sm text-muted" data-testid="iv-load-error">{loadError}</div>;
  if (!data) return <p className="mt-6 text-sm text-muted">Loading…</p>;

  const { settings, connection, videos, bucket } = data;

  return (
    <div className="mt-6 space-y-6" data-testid="intro-video-manager">
      {/* STORAGE STATUS */}
      <section className="rounded-2xl border border-line bg-white p-5" data-testid="iv-storage-status">
        <h2 className="text-base font-black text-ink">Storage</h2>
        {connection.ok ? (
          <p className="mt-1 text-sm font-semibold text-emerald-700" data-testid="iv-connected">Connected to bucket “{settings.bucket}”.</p>
        ) : !settings.configured ? (
          <div className="mt-1 text-sm text-amber-800" data-testid="iv-not-configured">
            <p className="font-semibold">Video storage is not configured yet.</p>
            <p className="mt-1">Missing settings (enter them in the secure key settings): {settings.missing.join(', ')}.</p>
          </div>
        ) : (
          <p className="mt-1 text-sm font-semibold text-red-700" data-testid="iv-connection-error">{connection.message || 'Video storage is unavailable right now.'}</p>
        )}
        <ul className="mt-3 grid gap-1 text-[13px] text-ink-soft sm:grid-cols-2">
          <li>Largest upload: <b>{mb(settings.max_bytes)}</b> — MP4, MOV or WebM</li>
          <li>New uploads are stored under <code>{settings.prefix}</code></li>
          <li>Playback links expire after <b>{Math.round(settings.playback_ttl_s / 60)} minutes</b></li>
          <li>Public custom domain: <b>{settings.public_domain ? 'configured' : 'not configured (signed links are used)'}</b></li>
        </ul>
      </section>

      {msg && (
        <p role="status" className={`sticky top-2 z-10 rounded-xl px-4 py-3 text-sm font-semibold shadow-sm ${msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`} data-testid="iv-message">
          {msg.text}
        </p>
      )}

      {/* UPLOAD */}
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="text-base font-black text-ink">Upload an approved video</h2>
        <form onSubmit={upload} className="mt-3 grid gap-3 sm:grid-cols-2" data-testid="iv-upload-form">
          <label className="text-sm font-bold text-ink-soft sm:col-span-2">
            Video file
            <input key={inputKey} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] || null)} className={`${INPUT} mt-1`} data-testid="iv-file" disabled={!ready} />
            {file && <span className={`mt-1 block text-[12px] ${file.size > maxBytes ? 'text-red-700' : 'text-muted'}`}>{file.name} · {mb(file.size)}</span>}
          </label>
          <label className="text-sm font-bold text-ink-soft">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={`${INPUT} mt-1`} placeholder="e.g. Welcome to NOSTOPS" data-testid="iv-title" disabled={!ready} />
          </label>
          <label className="text-sm font-bold text-ink-soft">
            Description (optional)
            <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} className={`${INPUT} mt-1`} data-testid="iv-description" disabled={!ready} />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className={PRIMARY} disabled={!ready || !file || title.trim().length < 3 || busy === 'upload'} data-testid="iv-upload-btn">
              {busy === 'upload' ? 'Uploading…' : 'Upload video'}
            </button>
          </div>
        </form>
      </section>

      {/* LIBRARY */}
      <section className="rounded-2xl border border-line bg-white p-5" data-testid="iv-library">
        <h2 className="text-base font-black text-ink">Library ({videos.length})</h2>
        {videos.length === 0 && (
          <div className="mt-2 text-sm text-muted" data-testid="iv-empty">
            <p>No videos yet. Upload checklist:</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              <li>Use the final, approved cut only.</li>
              <li>Export as MP4 (H.264 video, AAC audio) — or MOV / WebM — at most {mb(settings.max_bytes)}.</li>
              <li>Upload it here with a clear title, then preview it.</li>
              <li>Publish it. Switch it to Public only if anyone on the internet may watch it.</li>
            </ol>
          </div>
        )}
        <ul className="mt-3 space-y-3">
          {videos.map((v) => (
            <li key={v.id} className="rounded-xl border border-line p-4" data-testid={`iv-row-${v.id}`}>
              {edit?.id === v.id ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} maxLength={120} className={INPUT} aria-label="Title" data-testid="iv-edit-title" />
                  <input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} maxLength={600} className={INPUT} aria-label="Description" data-testid="iv-edit-description" />
                  <div className="flex gap-2">
                    <button type="button" className={PRIMARY} onClick={() => saveEdit(v)} disabled={busy === `patch-${v.id}`} data-testid="iv-edit-save">Save</button>
                    <button type="button" className={BTN} onClick={() => setEdit(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-ink">{v.title}</p>
                    <Chip on={v.status === 'PUBLISHED'} onLabel="Published" offLabel="Draft" />
                    <Chip on={v.visibility === 'PUBLIC'} onLabel="Public" offLabel="Private" />
                  </div>
                  {v.description && <p className="mt-1 text-sm text-ink-soft">{v.description}</p>}
                  <p className="mt-1 text-[12px] text-muted">
                    {mb(v.size)}{v.duration_s != null ? ` · ${dur(v.duration_s)}` : ''} · {v.content_type} · {v.source === 'uploaded' ? 'Uploaded via NOSTOPS' : 'Already in bucket'} · <code>{v.object_key}</code>
                    {v.created_at ? ` · ${fmt(v.created_at)}` : ''}{v.created_by ? ` · ${v.created_by}` : ''}
                  </p>
                </>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={BTN} onClick={() => setPreview(preview === v.id ? null : v.id)} data-testid={`iv-preview-${v.id}`}>{preview === v.id ? 'Hide preview' : 'Preview'}</button>
                <button type="button" className={BTN} disabled={!!busy} onClick={() => patch(v, { status: v.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }, v.status === 'PUBLISHED' ? 'Back to Draft.' : 'Published.')} data-testid={`iv-publish-${v.id}`}>
                  {v.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                </button>
                <button type="button" className={BTN} disabled={!!busy} onClick={() => toggleVisibility(v)} data-testid={`iv-visibility-${v.id}`}>
                  {v.visibility === 'PUBLIC' ? 'Make Private' : 'Make Public'}
                </button>
                <button type="button" className={BTN} onClick={() => setEdit({ id: v.id, title: v.title, description: v.description })} data-testid={`iv-edit-${v.id}`}>Edit</button>
                <button type="button" className={`${BTN} text-red-700`} onClick={() => setDel({ id: v.id, text: '' })} data-testid={`iv-delete-${v.id}`}>
                  {v.source === 'uploaded' ? 'Delete' : 'Remove from library'}
                </button>
              </div>
              {del?.id === v.id && (
                <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                  <p>{v.source === 'uploaded' ? 'This deletes the video file from storage. It cannot be undone.' : 'This only removes it from the library — the file stays in the bucket.'} Type <b>DELETE</b> to confirm.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input value={del.text} onChange={(e) => setDel({ ...del, text: e.target.value })} className={`${INPUT} max-w-[180px]`} aria-label="Type DELETE" data-testid="iv-delete-confirm-input" />
                    <button type="button" className={`${BTN} text-red-700`} disabled={del.text.trim().toUpperCase() !== 'DELETE' || busy === `del-${v.id}`} onClick={() => confirmDelete(v)} data-testid="iv-delete-confirm">Confirm</button>
                    <button type="button" className={BTN} onClick={() => setDel(null)}>Cancel</button>
                  </div>
                </div>
              )}
              {preview === v.id && <IntroVideoPlayer videoId={v.id} title={v.title} className="mt-3 max-w-xl" />}
            </li>
          ))}
        </ul>
      </section>

      {/* BUCKET CONTENTS (read-only) */}
      {ready && (
        <section className="rounded-2xl border border-line bg-white p-5" data-testid="iv-bucket">
          <h2 className="text-base font-black text-ink">Bucket contents ({bucket.objects.length}{bucket.truncated ? '+' : ''})</h2>
          <p className="mt-1 text-[13px] text-muted">Read-only. Files here are never renamed, moved or deleted from this page.</p>
          {bucket.objects.length === 0 ? (
            <p className="mt-2 text-sm text-muted" data-testid="iv-bucket-empty">The bucket is empty.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {bucket.objects.map((o) => (
                <li key={o.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 break-all"><code>{o.key}</code> <span className="text-muted">· {mb(o.size)}{o.last_modified ? ` · ${fmt(o.last_modified)}` : ''}</span></span>
                  {o.in_library ? (
                    <span className="text-[12px] font-bold text-emerald-700">In library</span>
                  ) : VIDEO_EXT.test(o.key) && !o.managed ? (
                    link?.key === o.key ? (
                      <span className="flex flex-wrap gap-2">
                        <input value={link.title} onChange={(e) => setLink({ ...link, title: e.target.value })} maxLength={120} placeholder="Title" className={`${INPUT} max-w-[220px]`} aria-label="Title" data-testid="iv-link-title" />
                        <button type="button" className={PRIMARY} disabled={link.title.trim().length < 3 || busy === 'link'} onClick={addLink} data-testid="iv-link-save">Add</button>
                        <button type="button" className={BTN} onClick={() => setLink(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button type="button" className={BTN} onClick={() => setLink({ key: o.key, title: '' })} data-testid="iv-link-btn">Add to library</button>
                    )
                  ) : (
                    <span className="text-[12px] text-muted">Not in library</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
