// Human labels for owner-editable venue fields (shared by server + client components).
export const VENUE_FIELD_LABELS: Record<string, string> = {
  contact_phone: 'contact phone', contact_email: 'contact email', website_or_maps_url: 'website', amenities: 'amenities',
  open_months: 'open months', getting_there: 'getting there', things_to_carry: 'things to carry', name: 'venue name', city: 'city',
  state: 'state', address: 'address', country: 'country', capacity: 'capacity', description: 'description', photos: 'photos',
  venue_type: 'venue type', best_for: 'best for',
};

export const fieldLabels = (keys: string[]) => keys.map((k) => VENUE_FIELD_LABELS[k] || k.replace(/_/g, ' ')).join(', ');

export const prettyType = (t?: string) => (t ? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '');
