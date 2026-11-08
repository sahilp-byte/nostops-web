'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBff, postBff } from '@/lib/auth-client';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { DEFAULT_LOCALE } from '@/lib/i18n/config';
import type { TeacherSelf, Codex, VideoIntro } from '@/lib/server/teacher';
import { deriveTeacherStatus } from '@/lib/teacher-status';
import TeacherProfileEditForm from './TeacherProfileEditForm';
import ProfileMediaManager from './ProfileMediaManager';

type EditorData = {
  handle: string | null;
  self?: TeacherSelf;
  social?: Record<string, string>;
  codex?: Codex;
  video?: VideoIntro;
};

const EMPTY_VIDEO: VideoIntro = {
  status: 'none',
  secureUrl: null,
  posterUrl: null,
  durationSeconds: null,
  rejectReason: null,
  uploadedAt: null,
};

/**
 * Owner-only inline editor mounted on the PUBLIC teacher profile page. It probes
 * ownership client-side (via /bff/teacher/self-editor which reads the httpOnly
 * session) so anonymous visitors and crawlers only ever see the read-only view.
 * When the signed-in teacher is viewing THEIR OWN profile, they get an inline
 * "Edit profile" panel that saves via the existing teacher BFF routes and then
 * revalidates the cached public page so their changes appear immediately.
 */
export default function PublicProfileOwnerEditor({ handle }: { handle: string }) {
  const router = useRouter();
  const [data, setData] = useState<EditorData | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let alive = true;
    getBff<EditorData>('/bff/teacher/self-editor').then((r) => {
      if (alive && r.ok) setData(r.data);
    });
    return () => {
      alive = false;
    };
  }, []);

  const isOwner = !!data?.handle && data.handle === handle;
  if (!isOwner || !data?.self || !data.codex) return null;

  const hasPhoto = !!data.self.avatarUrl;

  async function refreshPublic() {
    await postBff('/bff/teacher/revalidate-profile', { handle });
    // Re-read our own editor state so live-updated fields (e.g. the new photo)
    // reflect immediately and one-off nudges dismiss without a manual reload.
    const r = await getBff<EditorData>('/bff/teacher/self-editor');
    if (r.ok) setData(r.data);
    router.refresh();
  }

  return (
    <>
      {/* Missing-photo nudge — a real face measurably lifts bookings. Owner-only. */}
      {!hasPhoto && !editing && (
        <div className="border-b border-accent/30 bg-accent/10" data-testid="add-photo-nudge">
          <div className="container-x flex flex-wrap items-center justify-between gap-3 py-3">
            <p className="text-sm font-semibold text-ink-soft">
              📸 Add a profile photo — teachers with a real photo get noticeably more bookings.
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              data-testid="add-photo-cta"
              className="shrink-0 rounded-xl bg-accent px-5 py-2 text-sm font-bold text-white transition hover:bg-accent-600"
            >
              Add a photo
            </button>
          </div>
        </div>
      )}

      {/* Owner control bar */}
      <div className="border-b border-brand/20 bg-brand-50" data-testid="owner-edit-bar">
        <div className="container-x flex flex-wrap items-center justify-between gap-3 py-3">
          <p className="text-sm font-semibold text-brand-800">
            {editing
              ? 'Editing your public profile — saved changes appear on your live page.'
              : "This is your public profile, exactly as visitors see it."}
          </p>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            data-testid="owner-edit-toggle"
            className="shrink-0 rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white transition hover:bg-brand-600"
          >
            {editing ? 'Close editor' : '✎ Edit profile'}
          </button>
        </div>
      </div>

      {editing && (
        <section className="border-b border-line bg-cream" data-testid="owner-edit-panel">
          <div className="container-x py-8">
            <h2 className="text-2xl font-black tracking-tight text-ink">Edit your profile</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Update your photo, 90-second intro video, and all the details visitors see. Everything you
              onboarded with can be refined here — saved changes update your live public page.
            </p>
            <div className="mt-6 space-y-8">
              <ProfileMediaManager
                name={data.self.name}
                avatarUrl={data.self.avatarUrl ?? null}
                video={data.video ?? EMPTY_VIDEO}
                onChanged={refreshPublic}
              />
              <I18nProvider initialLocale={DEFAULT_LOCALE}>
                <TeacherProfileEditForm
                  self={data.self}
                  social={data.social ?? {}}
                  codex={data.codex}
                  canOperate={deriveTeacherStatus(data.self).canOperate}
                  onSaved={() => {
                    void refreshPublic();
                    setTimeout(() => setEditing(false), 1400);
                  }}
                />
              </I18nProvider>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
