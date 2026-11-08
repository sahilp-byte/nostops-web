// PROMPT 32 — Retreat structured data (client-safe, pure).
// The backend /seo/retreat/{id} already emits an EducationEvent (with Offer,
// Place location, organizer/performer Person) + a BreadcrumbList. Here we COMPOSE
// the complementary schema.org types the backend does not: Course (the taught
// immersion, with a CourseInstance + Offer), Review + AggregateRating (the host's
// NOSTOPS reviews, an owner-approved mapping since the backend has no per-retreat
// reviews), FAQPage, a standalone Person (teacher, with sameAs to their profile),
// and — when a venue is Google-connected — a LodgingBusiness with its rating.
// All URLs are canonicalised by the caller via normalizeJsonLd().
import { canonical } from '@/lib/site';
import { retreatPath } from '@/lib/retreat-url';

const CTX = 'https://schema.org';

type Review = { rating: number; text: string; name: string };
type HostReviews = { items: Review[]; avg: number; count: number };
type VenueReview = { author?: string; rating?: number; text?: string };
type VenueLike = {
  name?: string;
  address?: string;
  rating?: number;
  reviewCount?: number;
  mapsUri?: string;
  reviews?: VenueReview[];
} | null;

export type RetreatJsonLdArgs = {
  id: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  finalPriceInr?: number;
  soldOut: boolean;
  city?: string;
  state?: string;
  venueName?: string;
  guruName?: string;
  guruHandle?: string; // present only when the teacher profile is public/linkable
  hostType?: string;
  inLanguageList?: string[];
  faqItems: { q: string; a: string }[];
  hostReviews: HostReviews;
  venue: VenueLike;
};

function placeNode(a: RetreatJsonLdArgs) {
  const address: Record<string, unknown> = { '@type': 'PostalAddress', addressCountry: 'IN' };
  if (a.city) address.addressLocality = a.city;
  if (a.state) address.addressRegion = a.state;
  return {
    '@type': 'Place',
    name: a.venueName || [a.city, a.state].filter(Boolean).join(', ') || a.title,
    address,
  };
}

function offerNode(a: RetreatJsonLdArgs, url: string) {
  if (typeof a.finalPriceInr !== 'number') return undefined;
  return {
    '@type': 'Offer',
    url,
    price: String(a.finalPriceInr),
    priceCurrency: 'INR',
    category: 'Retreat',
    availability: a.soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
  };
}

function ratingBlock(hr: HostReviews, venue: VenueLike) {
  // Prefer the host's NOSTOPS reviews (owner-approved mapping); else the venue's
  // Google rating when the venue is connected. Never fabricate.
  if (hr.count > 0 && hr.avg > 0) {
    return {
      aggregate: { '@type': 'AggregateRating', ratingValue: Number(hr.avg.toFixed(1)), reviewCount: hr.count, bestRating: 5, worstRating: 1 },
      reviews: hr.items
        .filter((r) => r.text && r.rating > 0)
        .slice(0, 5)
        .map((r) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.name || 'A seeker' },
          reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
          reviewBody: r.text,
        })),
    };
  }
  if (venue && typeof venue.rating === 'number' && venue.rating > 0) {
    return {
      aggregate: { '@type': 'AggregateRating', ratingValue: Number(venue.rating.toFixed(1)), ...(venue.reviewCount ? { reviewCount: venue.reviewCount } : {}), bestRating: 5, worstRating: 1 },
      reviews: (venue.reviews || [])
        .filter((r) => r.text && typeof r.rating === 'number')
        .slice(0, 3)
        .map((r) => ({
          '@type': 'Review',
          author: { '@type': 'Person', name: r.author || 'A guest' },
          reviewRating: { '@type': 'Rating', ratingValue: r.rating as number, bestRating: 5, worstRating: 1 },
          reviewBody: r.text,
        })),
    };
  }
  return null;
}

export function buildRetreatJsonLd(a: RetreatJsonLdArgs): any[] {
  const url = canonical(retreatPath(a));
  const teacherUrl = a.guruHandle ? canonical(`/teachers/${a.guruHandle}`) : undefined;
  const place = placeNode(a);
  const offer = offerNode(a, url);
  const instructor = a.guruName
    ? { '@type': 'Person', name: a.guruName, ...(teacherUrl ? { url: teacherUrl } : {}) }
    : undefined;
  const rating = ratingBlock(a.hostReviews, a.venue);
  const inLanguage = a.inLanguageList && a.inLanguageList.length ? a.inLanguageList : ['en'];
  const desc = (a.description || a.title).slice(0, 600);

  const nodes: any[] = [];

  // 1 — COURSE (the taught yoga immersion) with a CourseInstance + Offer, and the
  // host's reviews/aggregateRating attached (Course validly supports both).
  const courseInstance: Record<string, unknown> = {
    '@type': 'CourseInstance',
    courseMode: 'Onsite',
    location: place,
  };
  if (a.startDate) courseInstance.startDate = a.startDate;
  if (a.endDate) courseInstance.endDate = a.endDate;
  if (instructor) courseInstance.instructor = instructor;
  if (offer) courseInstance.offers = offer;

  const course: Record<string, unknown> = {
    '@context': CTX,
    '@type': 'Course',
    '@id': `${url}#course`,
    url,
    name: a.title,
    description: desc,
    provider: { '@type': 'Organization', name: 'NOSTOPS', url: canonical('/') },
    about: 'Yoga',
    inLanguage,
    hasCourseInstance: courseInstance,
    ...(offer ? { offers: offer } : {}),
    ...(instructor ? { author: instructor } : {}),
  };
  if (rating) {
    course.aggregateRating = rating.aggregate;
    if (rating.reviews.length) course.review = rating.reviews;
  }
  nodes.push(course);

  // 2 — PERSON (teacher), with sameAs/url to the public profile when linkable.
  if (a.guruName) {
    const person: Record<string, unknown> = {
      '@context': CTX,
      '@type': 'Person',
      '@id': teacherUrl ? `${teacherUrl}#person` : `${url}#instructor`,
      name: a.guruName,
      jobTitle: 'Yoga Teacher',
      worksFor: { '@type': 'Organization', name: 'NOSTOPS' },
    };
    if (teacherUrl) {
      person.url = teacherUrl;
      person.mainEntityOfPage = teacherUrl;
    }
    nodes.push(person);
  }

  // 3 — LODGINGBUSINESS (venue) — only when a venue is Google-connected.
  if (a.venue && (a.venue.name || a.venue.address)) {
    const v = a.venue;
    const lodging: Record<string, unknown> = {
      '@context': CTX,
      '@type': 'LodgingBusiness',
      '@id': `${url}#venue`,
      name: v.name || a.venueName || 'Retreat venue',
      ...(v.address ? { address: v.address } : { address: place.address }),
      ...(v.mapsUri ? { hasMap: v.mapsUri } : {}),
    };
    if (typeof v.rating === 'number' && v.rating > 0) {
      lodging.aggregateRating = { '@type': 'AggregateRating', ratingValue: Number(v.rating.toFixed(1)), ...(v.reviewCount ? { reviewCount: v.reviewCount } : {}), bestRating: 5, worstRating: 1 };
    }
    const vReviews = (v.reviews || [])
      .filter((r) => r.text && typeof r.rating === 'number')
      .slice(0, 3)
      .map((r) => ({
        '@type': 'Review',
        author: { '@type': 'Person', name: r.author || 'A guest' },
        reviewRating: { '@type': 'Rating', ratingValue: r.rating as number, bestRating: 5, worstRating: 1 },
        reviewBody: r.text,
      }));
    if (vReviews.length) lodging.review = vReviews;
    nodes.push(lodging);
  }

  // 4 — FAQPage from the verified-facts FAQ.
  const faqs = a.faqItems.filter((x) => x.q && x.a);
  if (faqs.length) {
    nodes.push({
      '@context': CTX,
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }

  return nodes;
}
