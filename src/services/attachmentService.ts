import { apiClient } from "@/lib/apiClient";
import { downloadImage, uploadImage } from "@/lib/localApi";
import { imageError, imageLog, optimizeImage, type OptimizedImage } from "@/lib/imageOptimizer";
import { apiIdForCode, list, rec } from "./mappers";

/** Supported images (the data layer checks the same). Any original size is accepted: each image is optimized to about 20 KB before it is stored. SVG is left out on purpose: it can carry script. */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const MAX_IMAGES = 10;
export const FORMATS_TEXT = "JPG, PNG or WebP";
export type { OptimizedImage };

/** `size` is the stored (optimized) size; `originalSize` is what the file was before. */
export type Attachment = { id: number; name: string; type: string; size: number; originalSize: number; createdAt: string; by?: string };

const fromApi = (raw: unknown): Attachment => {
  const a = rec(raw) ?? {};
  return { id: Number(a.id), name: String(a.name ?? "image"), type: String(a.type ?? ""), size: Number(a.size ?? 0), originalSize: Number(a.originalSize ?? a.size ?? 0), createdAt: String(a.createdAt ?? ""), ...(a.by ? { by: String(a.by) } : {}) };
};

export const sizeText = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : bytes >= 100 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`);

/** The real format of a file, from its first bytes (a renamed document does not pass), or "" when it is not one of the supported images. */
async function sniff(file: File): Promise<string> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return "";
}

/**
 * Checks chosen files (by their real format, not their size) and optimizes each one. Returns the optimized images and a clear sentence for each file that can't be
 * used, so a person always sees why. `already` counts the images the Ticket or form has already.
 */
export async function optimizeImages(files: readonly File[], already = 0): Promise<{ ok: OptimizedImage[]; problems: string[] }> {
  const ok: OptimizedImage[] = [];
  const problems: string[] = [];
  for (const file of files) {
    const type = await sniff(file);
    if (!type) problems.push(`${file.name} isn't a supported image. Use ${FORMATS_TEXT}.`);
    else if (already + ok.length >= MAX_IMAGES) problems.push(`${file.name} was not added: at most ${MAX_IMAGES} images.`);
    else {
      try {
        ok.push(await optimizeImage(file, type));
      } catch (err) {
        problems.push(err instanceof Error ? err.message : `${file.name} couldn't be optimized.`);
      }
    }
  }
  return { ok, problems };
}

function apiId(code: string): number {
  const id = apiIdForCode(code);
  if (id == null) throw new Error("That Ticket isn't loaded yet. Reload the page and try again.");
  return id;
}

export async function listAttachments(ticketCode: string): Promise<Attachment[]> {
  const { data } = await apiClient.get<unknown>(`/items/${apiId(ticketCode)}/attachments`);
  return list(rec(data)?.attachments).map(fromApi);
}

/**
 * Saves images as attachments of a Ticket: the details go to the data (linked to the Ticket and, through it, its task), each file is uploaded to the shared storage under the same id. If a file can't be stored, what was saved is taken back so nothing half-attached is left.
 */
export async function addAttachments(ticketCode: string, images: readonly OptimizedImage[], commentId?: number): Promise<Attachment[]> {
  if (images.length === 0) return [];
  const { data } = await apiClient.post<unknown>(`/items/${apiId(ticketCode)}/attachments`, { ...(commentId != null ? { commentId } : {}), files: images.map((i) => ({ name: i.file.name, type: i.file.type, size: i.file.size, originalSize: i.originalSize })) });
  const made = list(rec(data)?.attachments).map(fromApi);
  try {
    await Promise.all(made.map((a, i) => uploadImage(a.id, images[i].file)));
    imageLog(`Image upload: Success (${made.map((a) => `${a.name} → attachment ${a.id}, ${ticketCode}`).join("; ")})`);
  } catch (err) {
    imageError("Image upload error: the image could not be saved", err);
    // The details were registered but a file did not arrive: they are taken back (which removes any file already stored), so nothing half-attached is left.
    await Promise.all(made.map((a) => apiClient.delete(`/attachments/${a.id}`).catch(() => undefined)));
    throw err;
  }
  return made;
}

export async function removeAttachment(id: number): Promise<void> {
  await apiClient.delete(`/attachments/${id}`);
  imageLog(`Image removed: attachment ${id}`);
}

/** A temporary address for showing a stored image (the caller revokes it); `undefined` when the file is not in the store. */
export async function imageUrl(id: number): Promise<string | undefined> {
  const blob = await downloadImage(id);
  return blob ? URL.createObjectURL(blob) : undefined;
}
