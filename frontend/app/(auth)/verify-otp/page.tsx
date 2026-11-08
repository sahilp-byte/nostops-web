import { redirect } from 'next/navigation';

// Phone OTP now lives on the Login page (Mobile OTP tab). Old links keep working.
export default function VerifyOtpPage() {
  redirect('/login?method=otp');
}
