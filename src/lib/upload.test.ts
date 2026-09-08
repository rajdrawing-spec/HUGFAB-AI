import { describe, expect, it } from 'vitest';
import { sniffImageType, validateImageUpload } from './upload';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];

function bytes(header: number[], length = 64): Uint8Array<ArrayBuffer> {
  const buffer = new Uint8Array(new ArrayBuffer(length));
  buffer.set(header, 0);
  return buffer;
}

function file(header: number[], type: string, name = 'upload'): File {
  return new File([bytes(header)], name, { type });
}

describe('magic-byte sniffing', () => {
  it('recognises the formats we accept', () => {
    expect(sniffImageType(bytes(PNG_HEADER))).toBe('image/png');
    expect(sniffImageType(bytes(JPEG_HEADER))).toBe('image/jpeg');

    const webp = bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(sniffImageType(webp)).toBe('image/webp');
  });

  it('rejects a RIFF container that is not WebP', () => {
    const wav = bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(sniffImageType(wav)).toBeNull();
  });

  it('rejects SVG, which is a script-execution vector', () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">');
    expect(sniffImageType(svg)).toBeNull();
  });
});

describe('upload validation', () => {
  it('accepts a well-formed image', async () => {
    const result = await validateImageUpload(file(PNG_HEADER, 'image/png', 'a.png'));
    expect(result).toMatchObject({ ok: true, type: 'image/png' });
  });

  it('rejects a payload wearing an image content-type', async () => {
    const php = new File(
      [new TextEncoder().encode('<?php system($_GET[0]); ?>')],
      'a.jpg',
      {
        type: 'image/jpeg',
      },
    );
    const result = await validateImageUpload(php);
    expect(result).toMatchObject({ ok: false, reason: 'content-mismatch' });
  });

  it('rejects a real image whose declared type is a lie', async () => {
    const result = await validateImageUpload(file(PNG_HEADER, 'image/jpeg', 'a.jpg'));
    expect(result).toMatchObject({ ok: false, reason: 'content-mismatch' });
  });

  it('rejects a disallowed content type outright', async () => {
    const result = await validateImageUpload(file(PNG_HEADER, 'application/pdf'));
    expect(result).toMatchObject({ ok: false, reason: 'type-not-allowed' });
  });

  it('enforces the size cap and rejects empty files', async () => {
    const big = new File([new Uint8Array(1024)], 'big.png', { type: 'image/png' });
    expect(await validateImageUpload(big, { maxBytes: 512 })).toMatchObject({
      ok: false,
      reason: 'too-large',
    });

    const empty = new File([], 'empty.png', { type: 'image/png' });
    expect(await validateImageUpload(empty)).toMatchObject({
      ok: false,
      reason: 'empty',
    });
  });
});
