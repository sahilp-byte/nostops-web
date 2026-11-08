import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin, toErrorText } from '@/lib/server/bff';
import { backendFetch } from '@/lib/server/session';
import { requireFeatureAccess } from '@/lib/server/teacher-access';
import { getBindableVenues } from '@/lib/server/venues';
import { venueDerivedFields, seatsOverCapacity } from '@/lib/server/venue-binding';
import { retreatDatesError } from '@/lib/retreat-dates';

// Create a hosted retreat (#36). CSRF-guarded, whitelisted proxy → POST
// /retreats/create. The backend owns host-eligibility, pricing bands and status.
const s = (v: any): string => (typeof v === 'string' ? v.trim() : '');
const clip = (v: any, n: number): string => s(v).slice(0, n);
const strArr = (v: any): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean).slice(0, 20) : [];
const enumArr = (v: any, allowed: Set<string>): string[] => strArr(v).filter((x) => allowed.has(x));
const THEMES = new Set(['faculty', 'founders', 'general', 'leadership', 'lineage', 'pranayama', 'stress']);
const FRAMINGS = new Set(['leadership_renewal', 'faculty_immersion', 'founders_reset']);
const PERSONAS = new Set(['founders', 'hr', 'hod', 'faculty', 'startup', 'senior_ic', 'mid_ic']);
const SENIORITY = new Set(['senior', 'mid', 'early', 'mixed']);
const LANGS = new Set(['english', 'hindi', 'mixed']);

export async function POST(req: NextRequest) {
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  // Defense-in-depth: the host-hosting feature must be enforced at the API too,
  // not just hidden in the UI (Prompt 14). Backend remains the ultimate authority.
  const gate = await requireFeatureAccess('retreat_hosting');
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const raw = await req.json().catch(() => ({}));

  const title = s(raw.title);
  const description = s(raw.description);
  const venueName = s(raw.venue_name);
  const venueCity = s(raw.venue_city);
  const startDate = s(raw.start_date);
  const endDate = s(raw.end_date);
  const seatsTotal = Math.floor(Number(raw.seats_total));
  const price = Math.floor(Number(raw.price_per_seat_inr));

  if (title.length < 6 || title.length > 120) return NextResponse.json({ error: 'Title must be 6–120 characters.' }, { status: 400 });
  if (venueName.length < 3) return NextResponse.json({ error: 'Enter a venue name.' }, { status: 400 });
  if (venueCity.length < 2) return NextResponse.json({ error: 'Enter a venue city.' }, { status: 400 });
  const dateErr = retreatDatesError(startDate, endDate); // TVR-13: format, no past start, end ≥ start
  if (dateErr) return NextResponse.json({ error: dateErr }, { status: 400 });
  if (description.length < 40 || description.length > 2000) return NextResponse.json({ error: 'Description must be 40–2000 characters.' }, { status: 400 });
  if (!Number.isFinite(seatsTotal) || seatsTotal < 4 || seatsTotal > 200) return NextResponse.json({ error: 'Seats must be between 4 and 200.' }, { status: 400 });
  if (!Number.isFinite(price) || price < 500 || price > 500000) return NextResponse.json({ error: 'Price per seat must be between ₹500 and ₹5,00,000.' }, { status: 400 });

  // Publication rule: a published retreat MUST reference an existing LISTED,
  // eligible venue. This BFF is the authoritative boundary we control — the
  // venue id is NEVER trusted from the browser; it is validated against the
  // existing public venue directory (active partners + admin-published) before
  // forwarding. (The remote /retreats/create treats venue_partner_id as optional,
  // so this enforcement lives here; see completion notes for the remote change.)
  const venuePartnerId = s(raw.venue_partner_id);
  if (!venuePartnerId) {
    return NextResponse.json({ error: 'Select a listed NOSTOPS venue to publish your retreat.' }, { status: 400 });
  }
  const eligibleVenues = await getBindableVenues({ limit: 100 }).catch(() => []);
  const venue = eligibleVenues.find((v) => v.id === venuePartnerId);
  if (!venue) {
    return NextResponse.json({ error: 'That venue is not a listed, eligible NOSTOPS venue. Please pick one from the list.' }, { status: 400 });
  }
  const capErr = seatsOverCapacity(seatsTotal, venue.capacity);
  if (capErr) return NextResponse.json({ error: capErr }, { status: 400 });

  const body: Record<string, unknown> = {
    title,
    description,
    venue_name: venueName,
    venue_city: venueCity,
    venue_partner_id: venuePartnerId,
    start_date: startDate,
    end_date: endDate,
    seats_total: seatsTotal,
    price_per_seat_inr: price,
    theme: THEMES.has(s(raw.theme)) ? s(raw.theme) : 'general',
  };
  const lat = Number(raw.venue_lat);
  const lng = Number(raw.venue_lng);
  if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
    body.venue_lat = lat;
    body.venue_lng = lng;
  }
  const state = s(raw.state);
  if (state) body.state = state;
  // Venue name / city / state (and coordinates when listed) are taken from the
  // chosen venue record — never from free text — so they can't contradict it.
  Object.assign(body, venueDerivedFields(venue, { venue_city: venueCity, state }));
  if (!body.state) delete body.state;
  const venueDescription = clip(raw.venue_description, 1000);
  if (venueDescription) body.venue_description = venueDescription;
  // Cover photo — a same-origin object-storage read URL (/bff/media/...) or an
  // external https image. Anything else is ignored.
  const cover = s(raw.cover_image);
  if (cover && cover.length <= 600 && (cover.startsWith('/bff/media/') || /^https?:\/\//.test(cover))) body.cover_image = cover;
  const tags = strArr(raw.audience_tags);
  if (tags.length) body.audience_tags = tags;
  const inclusions = strArr(raw.inclusions);
  if (inclusions.length) body.inclusions = inclusions;

  // Transparent pass-through venue cost (host still keeps price − platform fee; this
  // just discloses how much of the seat price is the venue's cost). Cannot exceed price.
  const venueCost = Math.floor(Number(raw.venue_cost_per_seat_inr));
  if (Number.isFinite(venueCost) && venueCost > 0) body.venue_cost_per_seat_inr = Math.min(venueCost, price);

  // Getting-there / logistics.
  const howTo = clip(raw.how_to_get_there, 800);
  if (howTo) body.how_to_get_there = howTo;
  const weather = clip(raw.weather_notes, 500);
  if (weather) body.weather_notes = weather;
  const youtube = clip(raw.youtube_tour_url, 300);
  if (youtube) body.youtube_tour_url = youtube;
  const whatToCarry = strArr(raw.what_to_carry);
  if (whatToCarry.length) body.what_to_carry = whatToCarry;

  // Framings (positioning) + Guru-authored journey protocols.
  const framings = enumArr(raw.framings, FRAMINGS);
  if (framings.length) body.framings = framings;
  const preRamp = clip(raw.pre_ramp_content, 5000);
  if (preRamp) body.pre_ramp_content = preRamp;
  const postSanskara = clip(raw.post_sanskara_content, 5000);
  if (postSanskara) body.post_sanskara_content = postSanskara;

  // Teacher-led cohort curation.
  if (raw.cohort_curated === true) body.cohort_curated = true;
  const personaMix = enumArr(raw.cohort_persona_mix, PERSONAS);
  if (personaMix.length) body.cohort_persona_mix = personaMix;
  const seniority = s(raw.cohort_seniority);
  if (SENIORITY.has(seniority)) body.cohort_seniority = seniority;
  const language = s(raw.cohort_language);
  if (LANGS.has(language)) body.cohort_language = language;
  const cohortNotes = clip(raw.cohort_notes, 1000);
  if (cohortNotes) body.cohort_notes = cohortNotes;

  const up = await backendFetch('/retreats/create', { method: 'POST', body: JSON.stringify(body) });
  const data = await up.json().catch(() => ({}));
  if (!up.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail[0]?.msg : data?.detail;
    return NextResponse.json({ error: toErrorText(detail, 'Could not create the retreat.') }, { status: up.status || 502 });
  }
  return NextResponse.json({ ok: true, data });
}
