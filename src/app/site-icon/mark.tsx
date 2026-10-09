/** The brick-course mark on a full-bleed ink tile, for icons drawn with ImageResponse. */
export function IconTile({ size }: { size: number }) {
  const u = size / 56; // scale from the 56px mark
  const bar = { height: 6.5 * u, background: "#FFFFFF", borderRadius: 2 * u };
  return (
    <div style={{ width: size, height: size, background: "#111110", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 30 * u, display: "flex", flexDirection: "column", gap: 4.5 * u }}>
        <div style={{ ...bar, display: "flex" }} />
        <div style={{ display: "flex", gap: 4.5 * u }}>
          <div style={{ ...bar, flex: 1 }} />
          <div style={{ ...bar, flex: 2 }} />
        </div>
        <div style={{ ...bar, display: "flex", background: "#E3672E" }} />
      </div>
    </div>
  );
}
