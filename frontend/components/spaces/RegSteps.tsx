import { SpStepper } from '@/components/spaces/ui';

// Phase 6 — the registration progress strip (Your details → Confirm & Pay → Done), as in the NOSTOPS registration designs.
export default function RegSteps({ current, paid }: { current: 1 | 2 | 3; paid: boolean }) {
  const steps = ['Your Details', paid ? 'Confirm & Pay' : 'Confirm', 'Done'];
  return (
    <div data-testid="reg-steps">
      <SpStepper steps={steps} current={current === 3 ? 3 : current - 1} isDone={(i) => i < current - 1 || current === 3} label="Registration progress" testIdPrefix="reg-step" />
    </div>
  );
}
