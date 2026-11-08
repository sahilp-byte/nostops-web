// Tiny cross-component UI signals for floating elements that must not cover
// each other on small screens (mobile menu ↔ Ask AI Guru ↔ sticky CTA).
export const MOBILE_NAV_EVENT = 'nostops:mobile-nav';
export const GURU_BUBBLE_EVENT = 'nostops:guru-bubble';

export function emitUiEvent(name: string, open: boolean): void {
  window.dispatchEvent(new CustomEvent<boolean>(name, { detail: open }));
}
