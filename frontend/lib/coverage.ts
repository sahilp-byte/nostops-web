// Phase 8B.2 — client-safe labels for the four approved locality coverage statuses
// (backend/spaces_locality_coverage.py STATUSES). No other statuses exist.
export const COVERAGE_STATUSES = ['NOT_STARTED', 'ONBOARDING', 'ACTIVE', 'PAUSED'] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export const COVERAGE_META: Record<CoverageStatus, { label: string; hint: string; chip: string; dot: string; bar: string }> = {
  NOT_STARTED: { label: 'Not started', hint: 'Tracked, onboarding has not begun', chip: 'bg-[#F1ECE3] text-[#4A4540] ring-[#D8CCBA]', dot: 'bg-[#9A9183]', bar: 'bg-[#C9C2B6]' },
  ONBOARDING: { label: 'Onboarding', hint: 'Partners, Spaces or teachers being onboarded', chip: 'bg-[#FDE7CC] text-[#7A2E05] ring-[#F7B36B]', dot: 'bg-[#E8690C]', bar: 'bg-[#F28A1E]' },
  ACTIVE: { label: 'Active', hint: 'Covered — the only status that counts as covered', chip: 'bg-[#E3F4D6] text-[#16632C] ring-[#9BD27F]', dot: 'bg-[#22A447]', bar: 'bg-[#22A447]' },
  PAUSED: { label: 'Paused', hint: 'Coverage temporarily on hold', chip: 'bg-[#ECE5FB] text-[#4B2F9C] ring-[#C4B3EE]', dot: 'bg-[#6B48C8]', bar: 'bg-[#8B6BD9]' },
};

export function isCoverageStatus(s: unknown): s is CoverageStatus {
  return typeof s === 'string' && (COVERAGE_STATUSES as readonly string[]).includes(s);
}

export const REASON_MIN = 10;
export const REASON_MAX = 1000;
