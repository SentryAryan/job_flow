/** Canonical resume object key — first path segment must be auth.uid() for storage RLS. */
export function resumeObjectKey(userId: string): string {
  return `${userId}/resume.pdf`;
}

/** Resolve the storage object key from a saved URL, falling back to the canonical path. */
export function resolveResumeStorageKey(
  userId: string,
  resumePdfUrl: string | null | undefined,
): string | null {
  if (resumePdfUrl) {
    const fromUrl = extractStorageObjectKey(resumePdfUrl);
    if (fromUrl) return fromUrl;
  }
  if (!userId) return null;
  return resumeObjectKey(userId);
}

/**
 * Extract object key from an InsForge storage URL
 * (`.../api/storage/buckets/<bucket>/objects/<urlencoded-key>`).
 */
export function extractStorageObjectKey(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const marker = "/objects/";
    const index = pathname.indexOf(marker);
    if (index === -1) return null;
    const encoded = pathname.slice(index + marker.length);
    if (!encoded) return null;
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}
