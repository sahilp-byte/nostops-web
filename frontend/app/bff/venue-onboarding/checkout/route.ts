import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { badOrigin } from '@/lib/server/bff';
import { tier2PreviewEnabled } from '@/lib/server/flags';
import { checkoutMode, createOnboardingLink, VENUE_FLOW, venueCheckoutClosedReason } from '@/lib/server/venue-onboarding';
import { financialLockedJson } from '@/lib/server/financial-lock';
import { paymentsDisabled, publicHost } from '@/lib/server/payment-guard';
import { isPayPalApproveUrl, isPreviewSuffix, VENUE_CHECKOUT_UNAVAILABLE_MESSAGE } from '@/lib/payment-mode';
import { billingRegion, ROUTING_MESSAGES } from '@/lib/payment-routing';

// Start a paid AI-onboarding purchase FOR ONE VENUE LISTING. Public (no sign-in)
// — the owner proves the listing with their signed edit-link token — but CSRF
// protected. The amount is NEVER taken from the client: the backend derives it
// from the chosen region, refuses venues that already paid, and re-uses an
// unfinished checkout so a double click never creates a second charge.
// India → Cashfree (INR); outside India → PayPal (USD, Prompt 4F). Sandbox runs only
// when the backend confirms sandbox for this exact preview host; live keys in preview,
// sandbox on a production host, or any error → refused (fail closed).
export async function POST(req: NextRequest) {
  if (!tier2PreviewEnabled()) return NextResponse.json({ error: 'Not available.' }, { status: 404 });
  if (badOrigin(req)) return NextResponse.json({ error: 'invalid origin' }, { status: 403 });
  // Prompt 4D — dual lock. A NEW venue checkout needs BOTH the money lock lifted for this checkout
  // (Prompt 4F: per-checkout unlock) AND the dedicated VENUE_CHECKOUT_ENABLED gate set to exactly
  // "true". Refused here, server-side, before the body is read and before checkoutMode,
  // createOnboardingLink or any backend or provider call.
  const locked = financialLockedJson(VENUE_FLOW);
  if (locked) return locked;
  if (venueCheckoutClosedReason()) {
    return NextResponse.json(
      { error: VENUE_CHECKOUT_UNAVAILABLE_MESSAGE, checkout_unavailable: true, reason: 'checkout_gate_closed' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  // Payments Prompt 2A — the buyer's billing country decides the provider, before anything else.
  // India → Cashfree (INR). Outside India → PayPal (USD). Never the other provider.
  const billing = String(body?.billing_country || '').trim().toUpperCase().slice(0, 8);
  if (!billing) return NextResponse.json({ error: ROUTING_MESSAGES.billing_country_required }, { status: 400 });
  const region = billingRegion(billing);
  if (!region) return NextResponse.json({ error: ROUTING_MESSAGES.billing_country_invalid }, { status: 400 });

  const host = publicHost(req);
  const mode = await checkoutMode(host);
  const provider = region === 'IN' ? mode : mode.paypal;
  const sandboxHere = provider.enabled && provider.sandbox && isPreviewSuffix(host);
  if (!sandboxHere) {
    if (region !== 'IN' && !provider.enabled) {
      return NextResponse.json({ error: ROUTING_MESSAGES.provider_unavailable, provider_unavailable: true }, { status: 503 });
    }
    const disabled = paymentsDisabled(req);
    if (disabled) return disabled;
    if (!provider.enabled || provider.mode !== 'production') {
      return NextResponse.json({ error: 'Payments are not available right now. You have not been charged.' }, { status: 503 });
    }
  }

  const token = String(body?.token || '').trim().slice(0, 512);
  const phone = String(body?.phone || '').trim().slice(0, 20);
  const name = body?.name ? String(body.name).trim().slice(0, 100) : undefined;

  if (token.length < 8) {
    return NextResponse.json({ error: 'Open this page from your venue\u2019s secure edit link to upgrade that listing.' }, { status: 400 });
  }
  if (phone && phone.replace(/\D/g, '').length < 7) {
    return NextResponse.json({ error: 'Please enter a valid phone number.' }, { status: 400 });
  }

  const { ok, status, data } = await createOnboardingLink({ token, phone, name, region, billing_country: billing }, host);
  const detail = data?.detail ?? data?.error;
  const failMsg = typeof detail === 'string' && detail.trim() ? detail : 'Could not start the payment. Please try again.';
  // The SDK / PayPal environment always matches what the backend actually used for this order.
  const orderMode = data?.mode === 'sandbox' ? 'sandbox' : 'production';
  if (region !== 'IN') {
    if (!ok || data?.provider !== 'paypal' || !data?.approve_url) {
      return NextResponse.json({ error: failMsg, already_paid: status === 409 }, { status: ok ? 502 : status || 502 });
    }
    if ((orderMode === 'sandbox') !== sandboxHere || !isPayPalApproveUrl(data.approve_url, orderMode)) {
      return NextResponse.json({ error: 'Payments are not available right now. You have not been charged.' }, { status: 503 });
    }
    return NextResponse.json({
      provider: 'paypal',
      approve_url: data.approve_url,
      mode: orderMode,
      order_id: data.order_id,
      amount: data.amount,
      currency: data.currency,
      reused: !!data.reused,
    });
  }
  if (!ok || !data?.payment_session_id) {
    return NextResponse.json({ error: failMsg, already_paid: status === 409 }, { status: status || 502 });
  }
  if ((orderMode === 'sandbox') !== sandboxHere) {
    return NextResponse.json({ error: 'Payments are not available right now. You have not been charged.' }, { status: 503 });
  }
  return NextResponse.json({
    provider: 'cashfree',
    payment_session_id: data.payment_session_id,
    mode: orderMode,
    order_id: data.order_id,
    amount: data.amount,
    currency: data.currency,
    reused: !!data.reused,
  });
}
