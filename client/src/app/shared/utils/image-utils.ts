export type ImageKind = 'image/jpeg' | 'image/png';

export const MIN_IMAGE_SIDE = 200;
export const WORKING_MAX_SIDE = 2000;

/** Reads the file's first bytes to identify JPEG/PNG, regardless of its name. */
export async function sniffImageType(file: Blob): Promise<ImageKind | null> {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => bytes[i] === b)) return 'image/png';
  return null;
}

/**
 * Decodes the image (respecting EXIF orientation) and returns a downscaled copy
 * at the working resolution (FR-U5) plus the original's dimensions.
 */
export async function prepareImage(
  file: Blob,
  maxSide = WORKING_MAX_SIDE,
): Promise<{ width: number; height: number; preview: Blob }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = bitmap;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not supported');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);

    const preview = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Encoding failed'))),
        'image/jpeg',
        0.9,
      ),
    );
    return { width, height, preview };
  } finally {
    bitmap.close();
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "living_room-2024.jpg" → "Living room 2024" */
export function titleFromFilename(name: string): string {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base || /^(img|dsc|dscn|pxl|image|photo)\s?\d*$/i.test(base)) return 'My room';
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 150);
}
