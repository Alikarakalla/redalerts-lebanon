/**
 * RedEdgeGlow
 * -----------
 * Wraps any page/layout and paints a continuous red glow
 * along every edge (top, bottom, left, right).
 *
 * Props:
 *   intensity  number   0–1     glow opacity multiplier   (default 0.55)
 *   color      string           CSS rgb color value       (default "220,38,38")
 *   pulse      boolean          animate in/out breathing  (default false)
 *   spread     number   px      how far glow bleeds in    (default 220)
 *   className  string           extra classes on wrapper
 *   children   ReactNode
 */
export default function RedEdgeGlow({
  intensity = 0.55,
  color = "220,38,38",
  pulse = false,
  spread = 220,
  className = "",
  children,
}) {
  const alpha = Math.min(1, Math.max(0, intensity)) * 0.75;

  const sides = [
    {
      key: "top",
      style: {
        position: "absolute", top: 0, left: 0, right: 0,
        height: spread,
        background: `radial-gradient(ellipse 80% 100% at 50% 0%, rgba(${color},${alpha.toFixed(3)}) 0%, transparent 70%)`,
        pointerEvents: "none",
      },
    },
    {
      key: "bottom",
      style: {
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: spread,
        background: `radial-gradient(ellipse 80% 100% at 50% 100%, rgba(${color},${alpha.toFixed(3)}) 0%, transparent 70%)`,
        pointerEvents: "none",
      },
    },
    {
      key: "left",
      style: {
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: spread,
        background: `radial-gradient(ellipse 100% 80% at 0% 50%, rgba(${color},${alpha.toFixed(3)}) 0%, transparent 70%)`,
        pointerEvents: "none",
      },
    },
    {
      key: "right",
      style: {
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: spread,
        background: `radial-gradient(ellipse 100% 80% at 100% 50%, rgba(${color},${alpha.toFixed(3)}) 0%, transparent 70%)`,
        pointerEvents: "none",
      },
    },
  ];

  return (
    <div className={`relative min-h-screen isolate ${className}`}>
      {/* Glow layer */}
      <div
        className={`pointer-events-none fixed inset-0 z-[1600] ${pulse ? "animate-pulse" : ""}`}
        aria-hidden="true"
      >
        {sides.map((s) => (
          <div
            key={s.key}
            style={{
              ...s.style,
              position: "fixed",
              mixBlendMode: "screen",
              filter: "blur(2px) saturate(1.08)",
            }}
          />
        ))}
        {/* Subtle 1px inner border to sharpen the edge */}
        <div
          className="fixed inset-0"
          style={{
            boxShadow: `inset 0 0 0 1px rgba(${color}, 0.22), inset 0 0 28px rgba(${color}, ${Math.min(0.24, alpha).toFixed(3)})`,
            pointerEvents: "none",
            mixBlendMode: "screen",
          }}
        />
      </div>

      {/* Page content sits above the glow */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
