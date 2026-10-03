import { formatBytes, sniffImageType, titleFromFilename } from './image-utils';

const blob = (bytes: number[]) => new Blob([new Uint8Array([...bytes, 0, 0, 0, 0, 0, 0, 0, 0])]);

describe('image utils', () => {
  it('identifies JPEG and PNG by content, not name', async () => {
    expect(await sniffImageType(blob([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(await sniffImageType(blob([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    );
    expect(await sniffImageType(new Blob(['GIF89a......']))).toBeNull();
    expect(await sniffImageType(new Blob(['<svg></svg>']))).toBeNull();
  });

  it('makes a friendly project title from the file name', () => {
    expect(titleFromFilename('living_room-final.jpg')).toBe('Living room final');
    expect(titleFromFilename('IMG_2041.JPG')).toBe('My room');
    expect(titleFromFilename('PXL_20260101_123.jpg')).toBe('PXL 20260101 123');
    expect(titleFromFilename('photo of lounge.png')).toBe('Photo of lounge');
    expect(titleFromFilename('.png')).toBe('My room');
  });

  it('formats byte sizes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB');
  });
});
