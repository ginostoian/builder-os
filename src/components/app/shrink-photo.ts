"use client";

/**
 * Shrink a photo in the browser before upload: at most 2,000 px on the long side, re-encoded as JPEG. That
 * keeps uploads small on site connections and drops the photo's location data (EXIF).
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const image = await decode(file);
  try {
    const scale = Math.min(1, 2_000 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d")!.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.82));
  } finally {
    image.done();
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; done: () => void };

/**
 * Read the picture. createImageBitmap is quickest, but some phones (older iPhones, and HEIC photos on a
 * few browsers) refuse it; an <img> can still read those, the right way up.
 */
async function decode(file: File): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (bitmap.width && bitmap.height) return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
    bitmap.close();
  } catch {
    // Fall through to <img>.
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("decode");
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
