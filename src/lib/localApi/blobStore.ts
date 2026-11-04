import { removeBlob } from "@/lib/server/store";

/** The image files of attachments live in the shared storage (lib/server/store.ts), one file per attachment id; the data holds only each image's details. */
export async function deleteFile(id: number): Promise<void> {
  removeBlob(id);
}
