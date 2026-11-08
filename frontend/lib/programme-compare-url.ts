// Shared (server + client) bits of the programme comparison.
export const MAX_COMPARE = 3;

export function compareHref(slugs: string[]): string {
  return `/programmes/compare?p=${slugs.join(',')}`;
}
