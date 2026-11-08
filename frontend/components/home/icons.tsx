// Line icons for the homepage (currentColor, decorative).
type P = { className?: string };

function Svg({ className, children, w = 1.8 }: P & { children: React.ReactNode; w?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export const ArrowRight = ({ className }: P) => <Svg className={className} w={2.2}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const ChevronRight = ({ className }: P) => <Svg className={className} w={2.4}><path d="m9 6 6 6-6 6" /></Svg>;

export const IconBuilding = ({ className }: P) => (
  <Svg className={className}>
    <path d="M4 21V4.8a.8.8 0 0 1 .8-.8h9.4a.8.8 0 0 1 .8.8V21" /><path d="M15 9h4.2a.8.8 0 0 1 .8.8V21" /><path d="M2.5 21h19" />
    <path d="M8 8h3M8 12h3M8 16h3M17.5 13v.01M17.5 17v.01" />
  </Svg>
);
export const IconGradCap = ({ className }: P) => (
  <Svg className={className}>
    <path d="m2 9 10-5 10 5-10 5L2 9Z" /><path d="M6 11v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /><path d="M22 9v6" />
  </Svg>
);
export const IconGroup = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="12" cy="7" r="3" /><circle cx="5" cy="9.5" r="2.2" /><circle cx="19" cy="9.5" r="2.2" />
    <path d="M7 20c0-3 2.2-5.2 5-5.2s5 2.2 5 5.2" /><path d="M1.8 19c0-2.3 1.4-4 3.4-4.3M22.2 19c0-2.3-1.4-4-3.4-4.3" />
  </Svg>
);
export const IconMind = ({ className }: P) => (
  <Svg className={className}>
    <path d="M14.5 21v-3.2h1.9a1.7 1.7 0 0 0 1.7-1.7v-2.6l1.7-.6a.6.6 0 0 0 .3-.9L18.4 9C18.4 5 15.4 3 12 3 8.3 3 5 5.6 5 9.6c0 2 .8 3.7 2.1 4.9V21" />
    <path d="M9.6 8.2a1.9 1.9 0 0 1 3.5-.8 1.8 1.8 0 0 1 1 3.2M10.4 11.8a1.6 1.6 0 0 0 2.6.2" />
  </Svg>
);
export const IconMeditate = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="12" cy="4.6" r="2.1" /><path d="M12 8v4.6" /><path d="M7.3 10.6 12 13l4.7-2.4" />
    <path d="M3.5 18.4c2.6-1.4 5.3-2.4 8.5-2.4s5.9 1 8.5 2.4" /><path d="M6 20.6h12" />
  </Svg>
);
export const IconWheelchair = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="10.5" cy="3.8" r="1.8" /><path d="M10.5 7v6.2h5.2l2.6 5.3" /><path d="M10.5 10h4.3" /><path d="M8 11.3a5.2 5.2 0 1 0 6.6 7.3" />
  </Svg>
);
export const IconAward = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="12" cy="9" r="5.2" /><path d="m9.2 13.6-1.6 7L12 18.2l4.4 2.4-1.6-7" /><path d="m12 6.6.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2.8-1.6Z" />
  </Svg>
);
export const IconNetwork = ({ className }: P) => (
  <Svg className={className}>
    <circle cx="12" cy="4.8" r="2" /><circle cx="4.8" cy="18.2" r="2" /><circle cx="19.2" cy="18.2" r="2" /><circle cx="12" cy="12.4" r="1.7" />
    <path d="M12 6.8v3.9M10.6 13.4l-4.2 3.4M13.4 13.4l4.2 3.4" />
  </Svg>
);
export const IconShieldCheck = ({ className }: P) => (
  <Svg className={className}>
    <path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-3Z" /><path d="m9 12 2 2 4-4" />
  </Svg>
);
export const IconVenue = ({ className }: P) => (
  <Svg className={className}>
    <path d="M3 11 12 4l9 7" /><path d="M5 9.6V20h14V9.6" /><path d="M10 20v-5h4v5" />
  </Svg>
);

export function IconCheckSolid({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" />
    </svg>
  );
}
