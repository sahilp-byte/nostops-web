import localFont from 'next/font/local';

// Hand-lettered display face for the homepage hero only (Kalam, SIL OFL — see ./fonts/OFL-Kalam.txt).
export const kalam = localFont({
  src: './fonts/Kalam-Bold.ttf',
  weight: '700',
  display: 'swap',
  fallback: ['cursive'],
});
