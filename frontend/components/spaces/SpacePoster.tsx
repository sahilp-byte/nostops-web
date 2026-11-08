'use client';

import { QRCodeSVG } from 'qrcode.react';

// A4 poster inviting yoga teachers to a Space. Public Space details only; QR opens the public Space page.
export default function SpacePoster({ url, name, place, model, type, capacity, photo }: {
  url: string; name: string; place: string; model: string; type: string; capacity: number; photo: string;
}) {
  return (
    <div className="min-h-screen bg-[#FFF8EE] py-6 print:bg-white print:py-0" data-testid="space-poster-page">
      <div className="mx-auto mb-4 flex max-w-[794px] justify-end gap-2 px-4 print:hidden">
        <button type="button" onClick={() => window.print()} className="min-h-[44px] rounded-xl bg-[#0F4C4A] px-5 text-sm font-bold text-white" data-testid="space-poster-print">Print or save as PDF</button>
      </div>
      <article className="mx-auto flex w-full max-w-[794px] flex-col overflow-hidden bg-white shadow-lg sm:aspect-[210/297] print:aspect-[210/297] print:shadow-none" data-testid="space-poster">
        <div className="bg-[#0F4C4A] px-8 py-5 text-white">
          <p className="text-[28px] font-extrabold tracking-tight">NOSTOPS Spaces</p>
          <p className="text-[15px] opacity-85">A Teacher&apos;s First Yoga Cooperative</p>
        </div>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="aspect-[16/9] w-full object-cover sm:aspect-auto sm:h-[34%] print:aspect-auto print:h-[34%]" />
        ) : <div className="h-24 w-full bg-[#FCE7CF] sm:h-[18%]" />}
        <div className="flex flex-1 flex-col px-8 py-6">
          <p className="text-[15px] font-bold uppercase tracking-wider text-[#E8690C]">Yoga teachers wanted</p>
          <h1 className="mt-1 text-[30px] font-extrabold leading-tight text-[#0F4C4A] sm:text-[40px]" data-testid="space-poster-name">{name}</h1>
          <p className="mt-1 text-[18px] font-semibold text-[#1C2A47]">{place}</p>
          <p className="mt-3 flex flex-wrap gap-2 text-[14px] font-bold">
            {model && <span className="rounded-full bg-[#FDE7CC] px-3 py-1 text-[#7A2E05]">{model} space</span>}
            {type && <span className="rounded-full bg-[#F1ECE3] px-3 py-1 text-[#1C2A47]">{type}</span>}
            {capacity ? <span className="rounded-full bg-[#F1ECE3] px-3 py-1 text-[#1C2A47]">Up to {capacity} people</span> : null}
          </p>
          <p className="mt-5 text-[19px] leading-snug text-[#1C2A47]">Teach yoga in your neighbourhood. This space is checked by NOSTOPS and open to NOSTOPS yoga teachers for classes and programmes.</p>
          <div className="mt-auto flex flex-col items-start justify-between gap-4 pt-6 sm:flex-row sm:items-end sm:gap-6">
            <div>
              <p className="text-[16px] font-bold text-[#0F4C4A]">Scan to see the space and send an enquiry</p>
              <p className="mt-1 break-all text-[13px] text-[#3B4762]" data-testid="space-poster-url">{url}</p>
            </div>
            <div className="shrink-0 rounded-xl border-4 border-[#F28A1E] bg-white p-2" data-testid="space-poster-qr"><QRCodeSVG value={url} size={150} level="M" marginSize={0} /></div>
          </div>
        </div>
      </article>
    </div>
  );
}
