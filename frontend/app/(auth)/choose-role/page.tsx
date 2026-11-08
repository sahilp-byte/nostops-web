import { redirect } from 'next/navigation';

// Beta: only the Yoga Teacher persona is available. The by-role chooser (HR /
// Coordinator / seeker) is disabled — everyone is routed to teacher onboarding.
export default function ChooseRolePage() {
  redirect('/join');
}
