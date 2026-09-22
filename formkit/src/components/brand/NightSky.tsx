/**
 * Night Sky — the animated background behind every public hero.
 *
 * Faisal's standing instruction: the photographic sky band is retired. Any hero
 * that wants a ground uses this component inside a
 * `position:relative; overflow:hidden; background:#0a3d6f` wrapper, with the
 * content in a `position:relative; z-index:1` child and white ink.
 *
 * The star field is generated from a fixed seed rather than Math.random so the
 * server and client render byte-identical markup and React does not warn about
 * a hydration mismatch.
 */

const STAR_TINTS = ["#f2f6fd", "#e3ecf8", "#cfdcee"] as const;

/** mulberry32 — small, fast, deterministic. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = {
  left: string;
  top: string;
  size: number;
  tint: string;
  opacity: string;
  duration: string;
  delay: string;
};

const STARS: Star[] = (() => {
  const rnd = seeded(0x5f1b607f);
  const out: Star[] = [];
  for (let i = 0; i < 88; i++) {
    const roll = rnd();
    const size = roll > 0.92 ? 3 : roll > 0.78 ? 2 : 1.4;
    out.push({
      left: `${(rnd() * 100).toFixed(2)}%`,
      top: `${(rnd() * 100).toFixed(2)}%`,
      size,
      tint: STAR_TINTS[Math.floor(rnd() * STAR_TINTS.length)],
      opacity: (0.36 + rnd() * 0.5).toFixed(2),
      duration: `${(2.5 + rnd() * 4.5).toFixed(1)}s`,
      delay: `-${(rnd() * 7).toFixed(1)}s`,
    });
  }
  return out;
})();

const WISPS = [
  {
    top: "10%",
    width: "56%",
    height: 74,
    duration: "47s",
    delay: "0s",
    tint: "222,240,252",
    bars: [
      { left: "0", top: 26, width: "86%", height: 10, mid: 0.44, blur: 7 },
      { left: "12%", top: 8, width: "58%", height: 7, mid: 0.3, blur: 6 },
      { left: "34%", top: 44, width: "44%", height: 6, mid: 0.26, blur: 6 },
    ],
  },
  {
    top: "34%",
    width: "44%",
    height: 62,
    duration: "66s",
    delay: "-27s",
    tint: "214,236,250",
    bars: [
      { left: "0", top: 20, width: "88%", height: 8, mid: 0.34, blur: 7 },
      { left: "26%", top: 38, width: "52%", height: 6, mid: 0.22, blur: 6 },
    ],
  },
  {
    top: "62%",
    width: "62%",
    height: 86,
    duration: "88s",
    delay: "-51s",
    tint: "206,230,248",
    bars: [
      { left: "0", top: 30, width: "84%", height: 12, mid: 0.3, blur: 9 },
      { left: "40%", top: 56, width: "50%", height: 8, mid: 0.2, blur: 8 },
    ],
  },
];

const ORBS = [
  {
    left: "-10%",
    top: "-60%",
    width: "70%",
    height: "200%",
    colour: "118,178,255",
    alpha: 0.55,
    blur: 56,
    duration: "16s",
    delay: "0s",
  },
  {
    right: "-6%",
    top: "-50%",
    width: "62%",
    height: "190%",
    colour: "150,216,255",
    alpha: 0.5,
    blur: 60,
    duration: "23s",
    delay: "-9s",
  },
  {
    left: "26%",
    bottom: "-90%",
    width: "56%",
    height: "190%",
    colour: "104,240,226",
    alpha: 0.4,
    blur: 64,
    duration: "31s",
    delay: "-19s",
  },
];

export function NightSky() {
  return (
    <div className="fk-sky" aria-hidden="true">
      <div className="fk-sky-grad" />
      <div className="fk-sky-wash-top" />
      <div className="fk-sky-wash-bottom" />
      <div className="fk-sky-horizon" />

      {WISPS.map((w, i) => (
        <div
          key={`w${i}`}
          className="fk-sky-wisp"
          style={{
            top: w.top,
            width: w.width,
            height: w.height,
            animationDuration: w.duration,
            animationDelay: w.delay,
          }}
        >
          {w.bars.map((b, j) => (
            <span
              key={j}
              style={{
                left: b.left,
                top: b.top,
                width: b.width,
                height: b.height,
                filter: `blur(${b.blur}px)`,
                background: `linear-gradient(90deg,rgba(${w.tint},0),rgba(${w.tint},${b.mid}),rgba(${w.tint},0))`,
              }}
            />
          ))}
        </div>
      ))}

      {ORBS.map((o, i) => (
        <div
          key={`o${i}`}
          className="fk-sky-orb"
          style={{
            left: o.left,
            right: o.right,
            top: o.top,
            bottom: o.bottom,
            width: o.width,
            height: o.height,
            filter: `blur(${o.blur}px)`,
            background: `radial-gradient(closest-side,rgba(${o.colour},${o.alpha}),rgba(${o.colour},0) 72%)`,
            animationDuration: o.duration,
            animationDelay: o.delay,
          }}
        />
      ))}

      <div className="fk-sky-flash" />

      {STARS.map((s, i) => (
        <span
          key={`s${i}`}
          className="fk-sky-star"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            background: s.tint,
            opacity: Number(s.opacity),
            boxShadow:
              s.size >= 3
                ? "0 0 9px 1.5px rgba(226,238,255,.75)"
                : s.size >= 2
                  ? "0 0 5px rgba(219,232,252,.6)"
                  : "0 0 4px rgba(219,232,252,.6)",
            animationDuration: s.duration,
            animationDelay: s.delay,
          }}
        />
      ))}

      <div
        className="fk-sky-shoot"
        style={{
          left: "62%",
          top: "8%",
          width: 160,
          transform: "rotate(18deg)",
          background: "linear-gradient(90deg,rgba(255,255,255,0),rgba(238,245,255,.9))",
          animationDuration: "26s",
        }}
      />
      <div
        className="fk-sky-shoot"
        style={{
          left: "18%",
          top: "38%",
          width: 120,
          transform: "rotate(22deg)",
          background: "linear-gradient(90deg,rgba(255,255,255,0),rgba(214,233,255,.8))",
          animationDuration: "37s",
          animationDelay: "-15s",
        }}
      />

      <div className="fk-sky-foot" />
    </div>
  );
}
