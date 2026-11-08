import 'server-only';
import { crc32 } from 'node:zlib';

// Prompt 2E (TVR-15) — an uploaded photo is accepted only when its BYTES are a real JPG, PNG or
// WebP image, of the same type the browser declared. The declared type (data-URI prefix or
// contentType) and the file name are never trusted on their own; the object is stored with the
// detected type and extension. Anything else (HTML / script with an image label, a mismatched
// or truncated / malformed file) is refused before it is stored.
export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export const IMAGE_EXT: Record<ImageType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const DECLARED: Record<string, ImageType> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
};

/** The declared type, normalised (image/jpg → image/jpeg); null when it isn't an allowed image type. */
export function declaredImageType(contentType: string): ImageType | null {
  return DECLARED[String(contentType || '').trim().toLowerCase()] ?? null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** JPEG: SOI, then well-formed marker segments up to a frame header and the scan, then EOI. */
function isJpeg(b: Buffer): boolean {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8 || b[2] !== 0xff) return false;
  let i = 2;
  let frame = false;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return false;
    const marker = b[i + 1];
    if (marker === 0xff) { i += 1; continue; } // fill byte
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) return false; // no scan yet
    const len = b.readUInt16BE(i + 2);
    if (len < 2 || i + 2 + len > b.length) return false;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) frame = true;
    if (marker === 0xda) {
      // Start of scan: entropy-coded data follows; the image must end with EOI after it.
      const eoi = b.lastIndexOf(Buffer.from([0xff, 0xd9]));
      return frame && eoi > i + 2 + len;
    }
    i += 2 + len;
  }
  return false;
}

/** PNG: signature, IHDR first, every chunk complete with a valid CRC, ending with IEND. */
function isPng(b: Buffer): boolean {
  if (b.length < 8 + 25 + 12 || !b.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  let i = 8;
  let first = true;
  while (i + 12 <= b.length) {
    const len = b.readUInt32BE(i);
    const type = b.subarray(i + 4, i + 8).toString('latin1');
    if (!/^[A-Za-z]{4}$/.test(type) || i + 12 + len > b.length) return false;
    if (first && (type !== 'IHDR' || len !== 13)) return false;
    first = false;
    if ((crc32(b.subarray(i + 4, i + 8 + len)) >>> 0) !== b.readUInt32BE(i + 8 + len)) return false;
    if (type === 'IEND') return true;
    i += 12 + len;
  }
  return false;
}

/** WebP: a complete RIFF/WEBP container whose first chunk is VP8, VP8L or VP8X. */
function isWebp(b: Buffer): boolean {
  if (b.length < 20 || b.toString('latin1', 0, 4) !== 'RIFF' || b.toString('latin1', 8, 12) !== 'WEBP') return false;
  const riff = b.readUInt32LE(4);
  if (riff + 8 > b.length || riff < 12) return false;
  const chunk = b.toString('latin1', 12, 16);
  if (chunk !== 'VP8 ' && chunk !== 'VP8L' && chunk !== 'VP8X') return false;
  return 20 + b.readUInt32LE(16) <= riff + 8;
}

/** The real type of the bytes, or null when they are not a well-formed JPG, PNG or WebP. */
export function detectImageType(buf: Buffer): ImageType | null {
  if (isJpeg(buf)) return 'image/jpeg';
  if (isPng(buf)) return 'image/png';
  if (isWebp(buf)) return 'image/webp';
  return null;
}

/** Accept only when the bytes are a real allowed image AND match the declared type. */
export function verifiedImageType(buf: Buffer, declared: ImageType): ImageType | null {
  const real = detectImageType(buf);
  return real && real === declared ? real : null;
}
