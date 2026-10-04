"use client";

/** The phone's location for a check-in, if the person allows it. Never blocks a check-in for long. */
export function whereAmI(): Promise<{ lat: number; lng: number } | undefined> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const done = setTimeout(() => resolve(undefined), 9_000);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(done);
        resolve({ lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 });
      },
      () => {
        clearTimeout(done);
        resolve(undefined);
      },
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    );
  });
}
