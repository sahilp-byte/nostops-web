import VenueGoogleConnect from '@/components/app/venue/VenueGoogleConnect';
import VenuePhotoUploader from '@/components/app/venue/VenuePhotoUploader';

// "Photos & Google listing" for a venue. Owners can either upload their own
// photos (up to 5, stored in Emergent Object Storage) OR connect their public
// Google Business listing (auto-pulls up to ~10 photos + rating & reviews).
// Both surface on the public venue page.
export default function VenuePhotosSection({ centerId, connected, photos, justCreated }: { centerId: string; connected: boolean; photos: string[]; justCreated?: boolean }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5" data-testid="venue-photos-section">
      {justCreated && (
        <div className="mb-4 rounded-xl border border-brand/20 bg-brand-50/60 px-4 py-3" data-testid="add-photos-nudge">
          <p className="text-sm font-extrabold text-ink">🎉 Venue created. Now make it inviting.</p>
          <p className="mt-1 text-sm text-ink-soft">Add a few photos below — the first becomes your cover on the public venue page. Or connect your Google listing to pull photos and reviews automatically.</p>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-ink">Photos</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Upload up to 5 photos of your space, or connect Google to show its photos, rating &amp; reviews.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <VenuePhotoUploader centerId={centerId} initial={photos} />
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <h3 className="text-sm font-extrabold text-ink">Prefer to use your Google listing?</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Paste your Google Maps / Business Profile link and NOSTOPS pulls up to 10 photos plus your rating &amp; reviews — no uploads needed.
        </p>
        <div className="mt-3">
          <VenueGoogleConnect centerId={centerId} connected={connected} />
        </div>
      </div>
    </section>
  );
}
