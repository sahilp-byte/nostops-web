// Published intro videos (metadata only — no storage keys, no links). Signed-out visitors get the
// PUBLIC ones; signed-in members also get PRIVATE ones. Identity comes from the httpOnly session.
import { getSessionUser } from '@/lib/server/session';
import { introVideoFetch, relay, unavailable } from '@/lib/server/intro-videos';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser().catch(() => null);
  try {
    return await relay(await introVideoFetch('/published', user), 'Videos are unavailable right now.');
  } catch {
    return unavailable();
  }
}
