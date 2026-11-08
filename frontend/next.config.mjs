import { PHASE_DEVELOPMENT_SERVER } from 'next/constants.js';
import { startDevCacheGuard } from './scripts/dev-cache-guard.mjs';


// Site-wide security headers (SEC-002). CSP is intentionally permissive enough
// to NOT break: Next.js inline bootstrap (unsafe-inline), GA4
// (googletagmanager/google-analytics), backend/Cloudinary images & the widget
// live-preview iframe (https:), base64 avatars (data:) and in-browser video
// recording (blob:). frame-ancestors / X-Frame-Options are intentionally OMITTED
// so the app stays embeddable in the Emergent webview/iframe. Google login is a
// top-level navigation to auth.emergentagent.com (not restricted by CSP).
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.google.com https://cloudflareinsights.com https://static.cloudflareinsights.com",
  "frame-src 'self' https:",
  "worker-src 'self' blob:",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'browsing-topics=(), payment=(), usb=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

// Same suffixes as lib/payment-mode.ts PREVIEW_SUFFIXES (regex form for `has`).
const PREVIEW_HOST_PATTERNS = ['.+\\.preview\\.emergentagent\\.com(:\\d+)?', '.+\\.preview\\.emergentcf\\.cloud(:\\d+)?'];
const NOINDEX_HEADER = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];

/** @type {import('next').NextConfig} */
let backendHost = '';
try {
  backendHost = new URL(process.env.BACKEND_URL || '').hostname;
} catch {
  backendHost = '';
}
const imageRemotePatterns = [
  { protocol: 'https', hostname: '**.emergentagent.com' },
  { protocol: 'https', hostname: '**.emergent.host' },
  { protocol: 'https', hostname: 'res.cloudinary.com' },
  { protocol: 'https', hostname: '**.googleusercontent.com' },
  { protocol: 'https', hostname: '**.googleapis.com' },
];
if (backendHost) imageRemotePatterns.push({ protocol: 'https', hostname: backendHost });

const nextConfig = {
  reactStrictMode: true,
  // Stage 5A: keep single-use claim tokens out of the dev/server request log.
  logging: { incomingRequests: { ignore: [/\/teachers\/claim\//] } },
  // SEO: render metadata (title, description, canonical, OG) BLOCKING in <head>
  // for search crawlers too. Next's default list streams metadata into <body> for
  // Googlebot (it runs JS); keeping it in the raw <head> is the safer reading for
  // canonicals. Default list + Googlebot/Bingbot/Applebot (crawler UAs only —
  // human visitors keep streaming).
  htmlLimitedBots: /Googlebot|[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight/i,
  // Allow the Emergent preview proxy origin to talk to the Next dev server (HMR/assets).
  allowedDevOrigins: [
    '*.preview.emergentagent.com',
    '*.emergentagent.com',
    '*.preview.emergentcf.cloud',
    '*.emergentcf.cloud',
    'trust-signals-live.preview.emergentagent.com',
    'trust-signals-live.cluster-12.preview.emergentcf.cloud',
    'connect-platform-web.cluster-12.preview.emergentcf.cloud',
    '**.preview.emergentcf.cloud',
  ],
  // SEC-001: never let the image optimizer fetch arbitrary hosts (SSRF /
  // open-proxy). Only these known, public image hosts are permitted; every other
  // host — including private/metadata ranges and any http URL — is rejected with
  // 400. Local /brand/* images are same-origin and always allowed. The backend
  // host is derived from BACKEND_URL so this stays correct across forks.
  images: {
    remotePatterns: imageRemotePatterns,
  },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      // Phase 4: preview hosts must never be indexed (robots.txt also disallows all there).
      ...PREVIEW_HOST_PATTERNS.flatMap((value) => [
        { source: '/:path*', has: [{ type: 'host', value }], headers: NOINDEX_HEADER },
        { source: '/:path*', has: [{ type: 'header', key: 'x-forwarded-host', value }], headers: NOINDEX_HEADER },
      ]),
      // Stage 5A: single-use claim tokens live in this URL — never cache, never send a referrer, never index.
      {
        source: '/teachers/claim/:token*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, private, max-age=0' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // B4.1: retired organisation audience pages → canonical cohort pages (exact paths only).
      { source: '/for-companies', destination: '/for-organisations/companies', permanent: true },
      { source: '/for-educational-institutions', destination: '/for-organisations/educational-institutions', permanent: true },
      { source: '/for-startup-networks', destination: '/for-organisations/startup-networking-groups', permanent: true },
    ];
  },
};

export default function config(phase) {
  // Dev only: keeps the Next.js dev cache from filling the disk (scripts/dev-cache-guard.mjs).
  if (phase === PHASE_DEVELOPMENT_SERVER) startDevCacheGuard();
  return nextConfig;
}
