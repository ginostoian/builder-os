import "server-only";
import { freshFileUrl } from "./storage";

/** A sent variation's frozen snapshot, with its photo links made current (signed when files are private). */
export function withFreshPhotos<T extends { photos?: { url: string }[] }>(snapshot: T): T {
  return snapshot.photos ? { ...snapshot, photos: snapshot.photos.map((p) => ({ url: freshFileUrl(p.url) })) } : snapshot;
}
