'use client';

import { useState } from 'react';

// One-tap "Add to calendar" — offers Google Calendar (link) and a downloadable
// .ics (Apple/Outlook/any). No dependencies. `start`/`end` are ms timestamps;
// pass allDay for multi-day retreats (date-only, end made exclusive).
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function fmtUTC(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}
function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}
function esc(s: string): string {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export default function AddToCalendar({
  title,
  start,
  end,
  details,
  location,
  allDay = false,
  className,
}: {
  title: string;
  start: number;
  end?: number;
  details?: string;
  location?: string;
  allDay?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const endTs = end ?? start + (allDay ? 0 : 60 * 60000);
  const dates = allDay
    ? `${fmtDate(start)}/${fmtDate(endTs + 86400000)}`
    : `${fmtUTC(start)}/${fmtUTC(endTs)}`;
  const googleUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${dates}` +
    (details ? `&details=${encodeURIComponent(details)}` : '') +
    (location ? `&location=${encodeURIComponent(location)}` : '');

  function downloadIcs() {
    const dtStart = allDay ? `DTSTART;VALUE=DATE:${fmtDate(start)}` : `DTSTART:${fmtUTC(start)}`;
    const dtEnd = allDay ? `DTEND;VALUE=DATE:${fmtDate(endTs + 86400000)}` : `DTEND:${fmtUTC(endTs)}`;
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//NOSTOPS//Yoga//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@nostops.org`,
      `DTSTAMP:${fmtUTC(Date.now())}`,
      dtStart,
      dtEnd,
      `SUMMARY:${esc(title)}`,
      details ? `DESCRIPTION:${esc(details)}` : '',
      location ? `LOCATION:${esc(location)}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ]
      .filter(Boolean)
      .join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^\w]+/g, '-').slice(0, 40) || 'event'}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setOpen(false);
  }

  return (
    <div className={`relative inline-block ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        data-testid="add-to-calendar"
        className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1 text-xs font-bold text-brand-700 transition hover:border-brand"
      >
        📅 Add to calendar
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-white shadow-lg" role="menu">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            data-testid="cal-google"
            className="block px-3 py-2 text-sm font-semibold text-ink transition hover:bg-cream"
          >
            Google Calendar
          </a>
          <button
            type="button"
            onClick={downloadIcs}
            data-testid="cal-ics"
            className="block w-full px-3 py-2 text-left text-sm font-semibold text-ink transition hover:bg-cream"
          >
            Apple / Outlook (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
