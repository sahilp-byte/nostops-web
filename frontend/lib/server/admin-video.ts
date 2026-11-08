import { backendFetch } from '@/lib/server/session';

// Admin teacher intro-video review data layer. Reads GET /api/admin/video-intro/queue.
// Approve / reject write through the admin-guarded BFF. Video is the same asset the
// teacher uploaded (Cloudinary) — the web only plays and moderates it.

const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

export type VideoSubmission = {
  teacherId: string;
  name: string;
  handle: string | null;
  city: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number;
  submittedAt: string | null;
};

function project(v: any): VideoSubmission {
  return {
    teacherId: str(v.teacher_id) || str(v.id) || '',
    name: str(v.name) || str(v.teacher_name) || 'Teacher',
    handle: str(v.handle) || str(v.teacher_handle),
    city: str(v.city),
    videoUrl: str(v.video_url) || str(v.intro_video_url) || str(v.hls_url) || str(v.url) || str(v.playback_url),
    thumbnailUrl: str(v.thumbnail_url) || str(v.poster_url),
    durationSeconds: num(v.duration_seconds ?? v.duration),
    submittedAt: str(v.submitted_at) || str(v.created_at) || str(v.uploaded_at),
  };
}

export async function getVideoQueue(): Promise<VideoSubmission[]> {
  const res = await backendFetch('/admin/video-intro/queue');
  const d = res.ok ? await res.json().catch(() => ({})) : {};
  return (Array.isArray(d.queue) ? d.queue : []).map(project).filter((v: VideoSubmission) => v.teacherId);
}
