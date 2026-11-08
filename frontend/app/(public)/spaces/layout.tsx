// NOSTOPS Spaces — every public Spaces page carries `.sp-page`, which switches on the Spaces
// visual system (app/spaces-theme.css) for the page, its header and its footer only.
export default function SpacesLayout({ children }: { children: React.ReactNode }) {
  return <div className="sp-page min-h-[60vh]">{children}</div>;
}
