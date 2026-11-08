// Shared NOSTOPS Voices constants + types. Safe to import from client OR server
// (no server-only imports here). Mirrors backend/voices.py vocabularies.

export const ARTICLE_TYPES = [
  'Article',
  'Opinion',
  'Essay',
  'Scholarly / Research Essay',
  'Teacher Perspective',
] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const MAX_WORDS = 950;
export const MAX_SUMMARY = 320;

export type VoicesStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED' | 'REJECTED';

export const STATUS_META: Record<VoicesStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Draft', badge: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: 'In review', badge: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Approved', badge: 'bg-sky-50 text-sky-700' },
  PUBLISHED: { label: 'Published', badge: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'Not accepted', badge: 'bg-red-50 text-red-700' },
};

// Article languages — reuse the platform's 6 supported locales.
export const VOICES_LANGS: Array<{ code: string; label: string; native: string }> = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
];

export function langLabel(code: string): string {
  return VOICES_LANGS.find((l) => l.code === code)?.label ?? code;
}

export function countWords(text: string): number {
  const t = (text || '').trim();
  return t ? t.split(/\s+/).length : 0;
}
