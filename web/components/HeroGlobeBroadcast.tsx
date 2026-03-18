"use client";

import { useEffect, useId, useRef, useState } from "react";

type HeroGlobeBroadcastProps = {
  audioPlaying: boolean;
};

const DEG = Math.PI / 180;
const TILT = 23 * DEG;
/** ~75s per full rotation */
const SPIN_PERIOD_SEC = 75;
const R = 292; // large sphere; ~584px diameter in viewBox space

function rotateTilt(
  x: number,
  y: number,
  z: number
): { x: number; y: number; z: number } {
  const yt = y * Math.cos(TILT) - z * Math.sin(TILT);
  const zt = y * Math.sin(TILT) + z * Math.cos(TILT);
  return { x, y: yt, z: zt };
}

/** Geographic: φ latitude, λ longitude (rad). Spin adds to λ (rotation about Y). */
function project(phi: number, lam: number, spin: number): { x: number; y: number; z: number } {
  const l = lam + spin;
  const x = Math.cos(phi) * Math.cos(l);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.sin(l);
  const p = rotateTilt(x, y, z);
  return { x: p.x * R, y: p.y * R, z: p.z * R };
}

const Z_CLIP = -0.08; // hide deep back-facing (in unit sphere before scale, use z/R)

function meridianToPath(lam: number, spin: number): string {
  const n = 80;
  let d = "";
  let pen = false;
  for (let i = 0; i <= n; i++) {
    const phi = -Math.PI / 2 + (Math.PI * i) / n;
    const u = Math.cos(phi) * Math.cos(lam + spin);
    const v = Math.sin(phi);
    const w = Math.cos(phi) * Math.sin(lam + spin);
    const p = rotateTilt(u, v, w);
    const vis = p.z > Z_CLIP;
    const sx = p.x * R;
    const sy = p.y * R;
    if (vis) {
      d += pen ? ` L ${sx.toFixed(2)} ${sy.toFixed(2)}` : `M ${sx.toFixed(2)} ${sy.toFixed(2)}`;
      pen = true;
    } else {
      pen = false;
    }
  }
  return d;
}

function parallelToPath(phi: number, spin: number): string {
  const n = 96;
  let d = "";
  let pen = false;
  for (let i = 0; i <= n; i++) {
    const lam = (2 * Math.PI * i) / n;
    const p = project(phi, lam, spin);
    const vis = p.z / R > Z_CLIP;
    if (vis) {
      d += pen ? ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      pen = true;
    } else {
      pen = false;
    }
  }
  return d;
}

/** Parallels: even spacing in latitude (degrees), excluding poles */
const PARALLELS_DEG = [75, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75];
const MERIDIANS_COUNT = 12;

export function HeroGlobeBroadcast({ audioPlaying }: HeroGlobeBroadcastProps) {
  const uid = useId().replace(/:/g, "");
  const spinRef = useRef(0);
  const rafRef = useRef<number>(0);
  const [, tick] = useState(0);

  useEffect(() => {
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      spinRef.current += (2 * Math.PI * dt) / SPIN_PERIOD_SEC;
      if (spinRef.current > Math.PI * 2) spinRef.current -= Math.PI * 2;
      acc += dt;
      if (acc >= 1 / 24) {
        acc = 0;
        tick((n) => (n + 1) % 10000);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const spin = spinRef.current;

  const meridianPaths: string[] = [];
  for (let k = 0; k < MERIDIANS_COUNT; k++) {
    const lam = (2 * Math.PI * k) / MERIDIANS_COUNT;
    meridianPaths.push(meridianToPath(lam, spin));
  }

  const parallelPaths: { d: string; equator: boolean }[] = [];
  for (const deg of PARALLELS_DEG) {
    const phi = deg * DEG;
    parallelPaths.push({
      d: parallelToPath(phi, spin),
      equator: deg === 0,
    });
  }

  const np = project(Math.PI / 2 - 0.001, 0, spin);
  const sp = project(-Math.PI / 2 + 0.001, 0, spin);

  const glowId = `globe-glow-${uid}`;
  const softId = `globe-soft-${uid}`;

  const vb = Math.ceil(R + 28);

  return (
    <div
      className="absolute inset-0 w-full h-full min-h-0 overflow-hidden pointer-events-none select-none"
      aria-hidden
    >
      <div
        className="absolute top-1/2 right-0 h-[440px] w-[440px] md:h-[480px] md:w-[480px] lg:h-[520px] lg:w-[520px]"
        style={{ transform: "translate(54%, -50%)" }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`-${vb} -${vb} ${vb * 2} ${vb * 2}`}
          preserveAspectRatio="xMidYMid meet"
          className="block"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id={softId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Silhouette / limb — reads clearly as a sphere */}
          <circle
            cx={0}
            cy={0}
            r={R}
            stroke="rgba(186, 210, 255, 0.38)"
            strokeWidth={1}
            filter={`url(#${softId})`}
          />

          {/* Latitude parallels (horizontal rings on globe) */}
          {parallelPaths.map(({ d, equator }, i) =>
            d ? (
              <path
                key={`p-${i}`}
                d={d}
                stroke={
                  equator
                    ? "rgba(210, 232, 255, 0.88)"
                    : "rgba(175, 205, 255, 0.52)"
                }
                strokeWidth={equator ? 1.45 : 0.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${glowId})`}
              />
            ) : null
          )}

          {/* Meridians — pole to pole */}
          {meridianPaths.map((d, i) =>
            d ? (
              <path
                key={`m-${i}`}
                d={d}
                stroke="rgba(200, 218, 255, 0.58)"
                strokeWidth={0.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${glowId})`}
              />
            ) : null
          )}

          {/* North & South pole markers */}
          {np.z / R > Z_CLIP && (
            <circle
              cx={np.x}
              cy={np.y}
              r={3.2}
              fill="rgba(240, 248, 255, 0.95)"
              filter={`url(#${softId})`}
            />
          )}
          {sp.z / R > Z_CLIP && (
            <circle
              cx={sp.x}
              cy={sp.y}
              r={3.2}
              fill="rgba(230, 240, 255, 0.88)"
              filter={`url(#${softId})`}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
