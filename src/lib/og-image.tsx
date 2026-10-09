import { ImageResponse } from "next/og";

/**
 * The picture shown when a page is shared (Open Graph and X cards): the brand mark, a small label and the
 * page's headline on the warm off-white page colour. 1200 × 630, the size every network expects.
 */
export const OG_SIZE = { width: 1200, height: 630 };

export function ogImage({ label, title, footer = "builder-os.co.uk" }: { label: string; title: string; footer?: string }) {
  const bar = { height: 13, background: "#FFFFFF", borderRadius: 4 };
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#FAFAF9", padding: "72px 80px", color: "#111110" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "#111110", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 34, display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ ...bar, display: "flex" }} />
              <div style={{ display: "flex", gap: 5 }}>
                <div style={{ ...bar, flex: 1 }} />
                <div style={{ ...bar, flex: 2 }} />
              </div>
              <div style={{ ...bar, display: "flex", background: "#E3672E" }} />
            </div>
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>Builder OS</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", fontSize: 28, color: "#E3672E", fontWeight: 600 }}>{label}</div>
          <div style={{ display: "flex", fontSize: title.length > 48 ? 64 : 78, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2.5, maxWidth: 1000 }}>{title}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#5C5B57" }}>
          <span>{footer}</span>
          <span>Built for UK renovation firms</span>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
