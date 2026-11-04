/**
 * Shrinks a chosen image to about 20 KB in the browser, keeping it as clear as it can. The result is a real File (a Blob), never Base64. This is lossy compression:
 * the pixels change, so it is never described as lossless. The picture keeps its original dimensions unless that is the only way to get near the target, and the
 * decoding and encoding run through the browser's async image APIs so the page stays responsive.
 */
export const TARGET_BYTES = 20 * 1024;
const MAX_QUALITY = 0.92;
const MIN_QUALITY = 0.3;
/** Dimensions are only reduced (in these steps) when the target can't be reached at the full size; clarity comes before an exact size. */
const SCALES = [1, 0.85];

export type OptimizedImage = {
  /** The optimized image, named as the original, ready to be stored. */
  file: File;
  originalType: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  /** False when the size stayed above the target because getting lower would have cost too much clarity. */
  reachedTarget: boolean;
  /** True when the file was already small enough and is stored untouched. */
  unchanged: boolean;
};

const dev = process.env.NODE_ENV !== "production";
const TAG = "[Ticket Image Optimization]";
export const imageLog = (...args: unknown[]) => dev && console.log(TAG, ...args);
export const imageError = (...args: unknown[]) => dev && console.error(TAG, ...args);

export const logSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${+(bytes / 1024 / 1024).toFixed(1)} MB` : `${+(bytes / 1024).toFixed(1)} KB`);

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Surface = OffscreenCanvas | HTMLCanvasElement;

function surface(width: number, height: number): Surface {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

function encode(s: Surface, type: string, quality: number): Promise<Blob> {
  if ("convertToBlob" in s) return s.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => s.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser could not encode the image."))), type, quality));
}

let webp: Promise<boolean> | null = null;
/** Whether this browser can encode WebP (Safari can't, and quietly returns PNG), so JPEG is used there. */
const canEncodeWebp = () =>
  (webp ??= (async () => {
    try {
      const probe = surface(2, 2);
      (probe as { getContext(id: "2d"): Ctx | null }).getContext("2d")?.fillRect(0, 0, 2, 2); // an encoder needs a context with something drawn
      return (await encode(probe, "image/webp", 0.8)).type === "image/webp";
    } catch {
      return false;
    }
  })());

export async function optimizeImage(file: File, originalType: string): Promise<OptimizedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    imageError("Compression error: the file could not be decoded", file.name, err);
    throw new Error(`${file.name} couldn't be read as an image.`);
  }
  try {
    const base = { originalType, originalSize: file.size, originalWidth: bitmap.width, originalHeight: bitmap.height };
    let result: OptimizedImage;
    if (file.size <= TARGET_BYTES) {
      result = { ...base, file, width: bitmap.width, height: bitmap.height, reachedTarget: true, unchanged: true };
    } else {
      const type = (await canEncodeWebp()) ? "image/webp" : "image/jpeg";
      let best: { blob: Blob; width: number; height: number } | null = null;
      let reached = false;
      for (const scale of SCALES) {
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        const canvas = surface(width, height);
        const ctx = (canvas as { getContext(id: "2d"): Ctx | null }).getContext("2d");
        if (!ctx) throw new Error("The browser could not prepare the image.");
        if (type === "image/jpeg") {
          ctx.fillStyle = "#fff"; // JPEG has no transparency
          ctx.fillRect(0, 0, width, height);
        }
        ctx.drawImage(bitmap, 0, 0, width, height);
        const top = await encode(canvas, type, MAX_QUALITY);
        if (top.size <= TARGET_BYTES) {
          best = { blob: top, width, height };
          reached = true;
          break;
        }
        const low = await encode(canvas, type, MIN_QUALITY);
        if (scale === 1) best = { blob: low, width, height }; // the fallback: full size at the lowest quality still thought clear
        if (low.size > TARGET_BYTES) continue;
        // The highest quality that still fits the target.
        let [lo, hi, pick] = [MIN_QUALITY, MAX_QUALITY, low];
        for (let i = 0; i < 6; i++) {
          const mid = (lo + hi) / 2;
          const b = await encode(canvas, type, mid);
          if (b.size <= TARGET_BYTES) [lo, pick] = [mid, b];
          else hi = mid;
        }
        best = { blob: pick, width, height };
        reached = true;
        break;
      }
      const b = best as NonNullable<typeof best>;
      result = { ...base, file: new File([b.blob], file.name, { type: b.blob.type }), width: b.width, height: b.height, reachedTarget: reached, unchanged: false };
    }
    const f = result.file;
    imageLog(
      [
        "",
        `Original File: ${file.name}`,
        `Original Type: ${originalType}`,
        `Original Size: ${logSize(file.size)}`,
        `Compressed Type: ${f.type}`,
        `Compressed Size: ${logSize(f.size)}${result.unchanged ? " (already small, kept as it is)" : result.reachedTarget ? "" : " (above 20 KB: a smaller size would have cost too much clarity)"}`,
        `Compression Ratio: ${Math.max(0, Math.round((1 - f.size / file.size) * 100))}%`,
        `Image Dimensions: ${result.width} x ${result.height}${result.width !== bitmap.width ? ` (original ${bitmap.width} x ${bitmap.height})` : ""}`,
        "Blob Object:",
      ].join("\n"),
      f,
    );
    return result;
  } catch (err) {
    imageError("Compression error", file.name, err);
    throw err instanceof Error ? err : new Error(`${file.name} couldn't be optimized.`);
  } finally {
    bitmap.close();
  }
}
