import { renderSpaceOg } from '@/lib/server/space-og';

// Stable same-origin URL for a Space's share card (owner preview). Same image as the public og:image.
export const runtime = 'nodejs';
export const revalidate = 300;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderSpaceOg(id);
}
