import SectionHead from './SectionHead';
import { ArrowRight } from './icons';

const STEPS = [
  { title: 'Select a Programme', desc: 'Choose from curated options.' },
  { title: 'Configure & Schedule', desc: 'Set group size and location.' },
  { title: 'Match with Teacher', desc: 'We recommend verified teachers.' },
  { title: 'Conduct Sessions', desc: 'Engage and participate.' },
  { title: 'Gather Feedback', desc: 'Measure impact and improve.' },
];

// 7 — From Intention to Impact: the organisation journey.
export default function JourneySection() {
  return (
    <section className="border-t border-[#EBE1D2] bg-[#FCFAF6]" data-testid="home-journey">
      <div className="container-x py-12 lg:py-14">
        <SectionHead title="From Intention to Impact" sub="A simple, structured journey for organisations." />
        <ol className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex items-center gap-3" data-testid="home-journey-step">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-[#E4532A] bg-white font-serif text-lg font-bold text-[#E4532A]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold leading-snug text-[#0E3D3B]">{s.title}</h3>
                <p className="text-[13px] leading-snug text-[#4A5F5C]">{s.desc}</p>
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="hidden h-4 w-4 shrink-0 text-[#9AA8A6] lg:block" />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
