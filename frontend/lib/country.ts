// Same India rule as the verification engine (_route_for); a blank country is
// treated as India (the BFF sends 'India' when the profile has none).
const INDIA = new Set(['india', 'in', 'bharat', 'ind']);

export function isIndiaCountry(country?: string | null): boolean {
  return INDIA.has((country || 'India').trim().toLowerCase());
}
