/**
 * Upload validation for the image-search and community uploads that arrive in
 * Phase 2 and 3. Written now so no feature has to invent its own rules later.
 *
 * A declared MIME type is attacker-controlled, so it is checked against the
 * file's actual magic bytes. A `.jpg` that begins with `<?php` or `<svg` is
 * rejected here rather than in production.
 */

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * SVG is deliberately absent: it is a script-execution vector, and nothing in
 * HugFab needs user-supplied vector art.
 */
const MAGIC_BYTES: ReadonlyArray<{
  type: AllowedImageType;
  offset: number;
  bytes: readonly number[];
}> = [
  { type: 'image/jpeg', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  {
    type: 'image/png',
    offset: 0,
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  // RIFF....WEBP — the size field sits between the two markers.
  { type: 'image/webp', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
  { type: 'image/avif', offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] },
];

export type UploadRejection =
  | { ok: false; reason: 'too-large'; message: string }
  | { ok: false; reason: 'empty'; message: string }
  | { ok: false; reason: 'type-not-allowed'; message: string }
  | { ok: false; reason: 'content-mismatch'; message: string };

export type UploadValidation =
  { ok: true; type: AllowedImageType; bytes: number } | UploadRejection;

function matchesMagic(
  view: Uint8Array,
  offset: number,
  bytes: readonly number[],
): boolean {
  if (view.length < offset + bytes.length) return false;
  return bytes.every((b, i) => view[offset + i] === b);
}

/** The detected type from content alone, or null if it is not an allowed image. */
export function sniffImageType(
  buffer: ArrayBuffer | Uint8Array,
): AllowedImageType | null {
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  for (const candidate of MAGIC_BYTES) {
    if (!matchesMagic(view, candidate.offset, candidate.bytes)) continue;

    if (candidate.type === 'image/webp') {
      // RIFF is a container; confirm the WEBP form at offset 8.
      if (!matchesMagic(view, 8, [0x57, 0x45, 0x42, 0x50])) continue;
    }
    if (candidate.type === 'image/avif') {
      // ftyp brand must be avif/avis, not heic or mp4.
      const brand = String.fromCharCode(...view.slice(8, 12));
      if (brand !== 'avif' && brand !== 'avis') continue;
    }
    return candidate.type;
  }
  return null;
}

export interface ValidateUploadOptions {
  maxBytes?: number;
  allowedTypes?: readonly AllowedImageType[];
}

export async function validateImageUpload(
  file: File,
  options: ValidateUploadOptions = {},
): Promise<UploadValidation> {
  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES;
  const allowed = options.allowedTypes ?? ALLOWED_IMAGE_TYPES;

  if (file.size === 0) {
    return { ok: false, reason: 'empty', message: 'That file is empty.' };
  }
  if (file.size > maxBytes) {
    const mb = Math.floor(maxBytes / (1024 * 1024));
    return {
      ok: false,
      reason: 'too-large',
      message: `Images must be ${mb} MB or smaller.`,
    };
  }
  if (!allowed.includes(file.type as AllowedImageType)) {
    return {
      ok: false,
      reason: 'type-not-allowed',
      message: 'Upload a JPEG, PNG, WebP or AVIF image.',
    };
  }

  // Only the header is needed; never read a whole upload into memory to sniff it.
  const header = await file.slice(0, 32).arrayBuffer();
  const detected = sniffImageType(header);

  if (detected === null || !allowed.includes(detected)) {
    return {
      ok: false,
      reason: 'content-mismatch',
      message: 'That file is not a valid image.',
    };
  }
  if (detected !== file.type) {
    // Mislabelled, deliberately or otherwise. Trust the bytes, refuse the file.
    return {
      ok: false,
      reason: 'content-mismatch',
      message: 'That file is not a valid image.',
    };
  }

  return { ok: true, type: detected, bytes: file.size };
}
