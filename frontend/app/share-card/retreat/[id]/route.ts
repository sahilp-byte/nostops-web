import { renderRetreatOg } from '@/lib/server/retreat-og';

// Stable same-origin URL for a retreat's social share card, used by the in-app
// ShareCardPreview on the host's Manage Retreat screen. Re-renders the SAME
// next/og image as the public retreat page's opengraph-image. Public data only.
export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderRetreatOg(id);
}
