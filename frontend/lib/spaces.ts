// Shared NOSTOPS Spaces labels (client + server safe). Phase 3.
export const SPACE_TYPES: Record<string, string> = {
  community_hall: 'Community hall', yoga_studio: 'Yoga studio', school_college: 'School or college',
  society_clubhouse: 'Society clubhouse', temple_ashram: 'Temple or ashram', office_corporate: 'Office or corporate space',
  park_open_space: 'Park or open space', home_studio: 'Home studio', other: 'Other',
};
// Phase 1b — the ONLY three official venue participation models. Classification only: NOSTOPS never
// stores, calculates, collects or distributes rents, revenue shares, commissions or payouts for Spaces.
export const SPACE_MODELS: Record<string, { label: string; badge: string; icon: string; blurb: string; choose: string; example: string; tone: string }> = {
  commercial: {
    label: 'Commercial', badge: 'Paid venue usage', icon: '🏢', tone: 'bg-[#FDE3CC] text-[#9A3B0B]',
    blurb: 'Regular, paid use of the space for yoga classes, workshops, trainings and events.',
    choose: 'Choose Commercial if the space is normally used on a paid basis.',
    example: 'A yoga studio or hall that is usually hired for sessions or by the day.',
  },
  subsidised: {
    label: 'Subsidised', badge: 'Reduced venue fee', icon: '🤝', tone: 'bg-[#E4F4D6] text-[#2F6B1F]',
    blurb: 'Partially supported or concessional use, often for schools, societies, trusts and community or institutional wellness.',
    choose: 'Choose Subsidised if the space is offered on a reduced or concessional basis.',
    example: 'A school or community hall that supports yoga programmes at a concession.',
  },
  community: {
    label: 'Community', badge: 'Free venue usage', icon: '👥', tone: 'bg-[#ECE5FB] text-[#4A2E86]',
    blurb: 'A goodwill contribution: the space is made available free of charge for community well-being.',
    choose: 'Choose Community if the space is offered free of charge for community well-being.',
    example: 'A temple hall, trust property or community centre offered free for well-being activities.',
  },
};
export const OFFICIAL_MODELS_NOTE =
  'These are the only three official venue models on NOSTOPS. There is no revenue share model. Any independent arrangement between a venue owner and a yoga teacher is a private agreement, outside the NOSTOPS platform.';
export const FACILITIES: Record<string, string> = {
  mats: 'Yoga mats', props: 'Props (blocks, straps)', changing_room: 'Changing room', washroom: 'Washroom',
  drinking_water: 'Drinking water', parking: 'Parking', fans: 'Fans', air_conditioning: 'Air conditioning',
  sound_system: 'Sound system', projector: 'Projector / screen', wheelchair_access: 'Wheelchair access',
  natural_light: 'Natural light', outdoor_area: 'Outdoor area', storage: 'Storage',
};
export const DOC_KINDS: Record<string, { label: string; hint: string }> = {
  ownership_proof: { label: 'Proof of ownership or permission letter', hint: 'Sale deed, rent agreement or a signed letter from the owner.' },
  society_noc: { label: 'Society or building NOC', hint: 'No-objection letter from the society, RWA or building management.' },
  photo_id: { label: 'Government photo ID', hint: 'Aadhaar, PAN, passport, voter ID or driving licence of the person listing.' },
  address_proof: { label: 'Address proof of the Space', hint: 'Electricity bill, property tax receipt or similar.' },
};
export const SPACE_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'bg-gray-100 text-gray-700' },
  submitted: { label: 'Under NOSTOPS review', tone: 'bg-amber-100 text-amber-800' },
  changes_requested: { label: 'Changes requested', tone: 'bg-orange-100 text-orange-800' },
  approved: { label: 'Approved · Live', tone: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Not approved', tone: 'bg-red-100 text-red-700' },
  unlisted: { label: 'Unlisted · hidden from public search', tone: 'bg-gray-200 text-gray-800' },
  withdrawn: { label: 'Withdrawn draft', tone: 'bg-gray-100 text-gray-600' },
};
export const CHECKLIST_LABELS: Record<string, string> = {
  address_matches: 'Address matches the PIN and locality', space_matches_photos: 'Space matches the photos',
  capacity_confirmed: 'Capacity confirmed', safe_and_clean: 'Safe and clean', washroom_water: 'Washroom and drinking water available',
  documents_match_owner: 'Documents match the person listing',
};

// Phase 4 — Teacher → Space enquiry labels.
export const GROUP_TYPES: Record<string, string> = {
  corporate: 'Corporate group', residential_society: 'Residential society', school_college: 'School or college',
  ngo_community: 'NGO or community group', general_public: 'General public', institution: 'Institution', other: 'Other',
};
export const PARTICIPANT_PROFILES: Record<string, string> = {
  adults_general: 'Adults (general wellness)', seniors: 'Seniors', children_youth: 'Children and youth', women: 'Women',
  mixed_general: 'Mixed (general wellness)', special_needs: 'Special needs', other: 'Other',
};
export const WEEK_DAYS: [string, string][] = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
export function fmtTime(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export const FOCUS_AREAS: Record<string, string> = { mind: 'MIND', body: 'BODY', special_needs: 'SPECIAL NEEDS' };
export const ENQUIRY_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft · not sent', tone: 'bg-gray-100 text-gray-700' },
  sent: { label: 'New', tone: 'bg-amber-100 text-amber-800' },
  in_discussion: { label: 'In Discussion', tone: 'bg-sky-100 text-sky-800' },
  accepted_in_principle: { label: 'Accepted in principle', tone: 'bg-emerald-100 text-emerald-800' },
  declined: { label: 'Declined · Closed', tone: 'bg-red-100 text-red-700' },
};

// Enquiry history action labels (shared by the owner and teacher enquiry pages).
// Spaces enquiry pages (owner + teacher): the Ask AI Guru launcher docks over the sidebar on desktop (AppShell reserves room).
export const ENQUIRY_ROUTE = /^\/app\/spaces\/(incoming|enquiries)(\/|$)/;
// Role-specific wording for "private arrangement" notices on enquiry pages.
export const enquiryParties = (viewer?: string) =>
  viewer === 'teacher' ? 'between you and the venue owner' : viewer === 'owner' ? 'between you and the teacher' : 'between the enquiry participants';
// History is always shown oldest first, newest last, for every role.
export const historyOldestFirst = <T extends { at: string }>(h: T[] = []) => h.slice().sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
export const ENQUIRY_ACTION: Record<string, string> = {
  draft_created: 'Draft created', sent: 'Enquiry sent', owner_notified: 'Owner notified by email', owner_notify_failed: 'Owner email failed',
  in_discussion: 'In discussion', accepted_in_principle: 'Accepted in principle', alternative_dates_proposed: 'Alternative dates proposed',
  declined: 'Declined', teacher_notified: 'Teacher notified by email', teacher_notify_failed: 'Teacher email failed', venue_terms_updated: 'Venue terms updated',
};
