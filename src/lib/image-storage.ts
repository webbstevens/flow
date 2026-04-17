import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const BUCKET = "classify-images";

interface UploadResult {
  path: string;
  publicUrl: string;
}

function storageClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Upload an image buffer to the classify-images bucket. Relies on an RLS
 * policy allowing INSERTs to this bucket from the anon/authenticated roles.
 */
export async function uploadClassifyImage(
  buffer: Buffer,
  contentType: string,
  workspaceId: string | null,
): Promise<UploadResult | null> {
  if (!isStorageConfigured()) return null;

  const ext = extensionFromContentType(contentType);
  const folder = workspaceId ?? "anon";
  const path = `${folder}/${randomUUID()}.${ext}`;

  const supabase = storageClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType, upsert: false });

  if (error) {
    console.error("[image-storage] upload failed", error);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

/**
 * Given a storage path (from ClassificationRecord.imageStoragePath), return
 * the public URL. Returns null if storage isn't configured or path is falsy.
 */
export function publicUrlForPath(path: string | null | undefined): string | null {
  if (!path || !isStorageConfigured()) return null;
  const { data } = storageClient().storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function extensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  return map[contentType.toLowerCase()] ?? "jpg";
}
