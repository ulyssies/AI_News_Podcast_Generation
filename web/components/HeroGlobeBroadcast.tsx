"use client";

import { useEffect, useId, useRef, useState } from "react";

type HeroGlobeBroadcastProps = {
  /** "bleed" (default): globe positioned right, bleeds off the card edge.
   *  "centered": globe centered within its container — used for the idle right panel.
   *  "mobile": same centering as "centered" but constrained for the mobile divider. */
  variant?: "bleed" | "centered" | "mobile";
  activity?: "idle" | "active";
  progress?: number;
};

const DEG = Math.PI / 180;
const TILT = 23 * DEG;
const IDLE_SPIN_PERIOD_SEC = 24;
const ACTIVE_SPIN_PERIOD_SEC = 16;
const ACTIVE_SPIN_ACCELERATION_SEC = 9;
const MIN_ACTIVE_SPIN_PERIOD_SEC = 6;
const FRAME_INTERVAL_SEC = 1 / 42;
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

export function HeroGlobeBroadcast({
  variant = "bleed",
  activity = "idle",
  progress = 0,
}: HeroGlobeBroadcastProps) {
  const uid = useId().replace(/:/g, "");
  const spinRef = useRef(0);
  const rafRef = useRef<number>(0);
  const activityRef = useRef(activity);
  const progressRef = useRef(progress);
  const [, tick] = useState(0);

  useEffect(() => {
    activityRef.current = activity;
  }, [activity]);

  useEffect(() => {
    progressRef.current = Math.min(99, Math.max(0, progress));
  }, [progress]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      const progressRatio = progressRef.current / 100;
      const spinPeriod =
        activityRef.current === "active"
          ? Math.max(
              MIN_ACTIVE_SPIN_PERIOD_SEC,
              ACTIVE_SPIN_PERIOD_SEC - progressRatio * ACTIVE_SPIN_ACCELERATION_SEC
            )
          : IDLE_SPIN_PERIOD_SEC;
      spinRef.current += (2 * Math.PI * dt) / spinPeriod;
      if (spinRef.current > Math.PI * 2) spinRef.current -= Math.PI * 2;
      acc += dt;
      if (acc >= FRAME_INTERVAL_SEC) {
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

  const scanPhi = Math.sin(spin * 0.72) * 28 * DEG;
  const scanPath = parallelToPath(scanPhi, spin * 0.35);

  const glowId = `globe-glow-${uid}`;
  const softId = `globe-soft-${uid}`;
  const scanId = `globe-scan-${uid}`;
  const surfaceId = `globe-surface-${uid}`;
  const shadowId = `globe-shadow-${uid}`;
  const auraId = `globe-aura-${uid}`;
  const clipId = `globe-clip-${uid}`;
  const edgeFadeId = `globe-edge-fade-${uid}`;
  const edgeMaskId = `globe-edge-mask-${uid}`;

  const vb = Math.ceil(R + 48);

  return (
    <div
      className="absolute inset-0 w-full h-full min-h-0 pointer-events-none select-none"
      aria-hidden
    >
      <div
        className={
          variant === "centered"
            ? "absolute top-1/2 left-1/2 h-[560px] w-[560px] lg:h-[680px] lg:w-[680px]"
            : variant === "mobile"
            ? "absolute top-1/2 left-1/2 h-[320px] w-[320px]"
            : "absolute top-1/2 right-0 h-[440px] w-[440px] md:h-[480px] md:w-[480px] lg:h-[520px] lg:w-[520px]"
        }
        style={{
          transform:
            variant === "bleed" ? "translate(54%, -50%)" : "translate(-50%, -50%)",
        }}
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
            <linearGradient id={scanId} x1="-1" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(99,102,241,0)" />
              <stop offset="45%" stopColor="rgba(129,140,248,0.95)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </linearGradient>
            <radialGradient id={surfaceId} cx="34%" cy="28%" r="78%">
              <stop
                offset="0%"
                stopColor={
                  activity === "active"
                    ? "rgba(210, 226, 255, 0.42)"
                    : "rgba(190, 210, 255, 0.26)"
                }
              />
              <stop offset="42%" stopColor="rgba(45, 61, 112, 0.34)" />
              <stop offset="72%" stopColor="rgba(18, 25, 49, 0.50)" />
              <stop offset="100%" stopColor="rgba(3, 6, 18, 0.82)" />
            </radialGradient>
            <radialGradient id={shadowId} cx="72%" cy="76%" r="78%">
              <stop offset="0%" stopColor="rgba(0, 0, 0, 0)" />
              <stop offset="56%" stopColor="rgba(0, 0, 0, 0.18)" />
              <stop offset="100%" stopColor="rgba(0, 0, 0, 0.78)" />
            </radialGradient>
            <radialGradient id={auraId} cx="50%" cy="50%" r="54%">
              <stop offset="0%" stopColor="rgba(99, 102, 241, 0.22)" />
              <stop offset="60%" stopColor="rgba(34, 211, 238, 0.08)" />
              <stop offset="100%" stopColor="rgba(34, 211, 238, 0)" />
            </radialGradient>
            <radialGradient id={edgeFadeId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity={1} />
              <stop offset="72%" stopColor="#fff" stopOpacity={1} />
              <stop offset="91%" stopColor="#fff" stopOpacity={0.46} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0.06} />
            </radialGradient>
            <clipPath id={clipId}>
              <circle cx={0} cy={0} r={R} />
            </clipPath>
            <mask
              id={edgeMaskId}
              maskUnits="userSpaceOnUse"
              x={-R}
              y={-R}
              width={R * 2}
              height={R * 2}
            >
              <circle cx={0} cy={0} r={R} fill={`url(#${edgeFadeId})`} />
            </mask>
          </defs>

          <circle
            cx={0}
            cy={0}
            r={R + 46}
            fill={`url(#${auraId})`}
            opacity={activity === "active" ? 0.95 : 0.52}
            className="globe-breath"
          />

          <circle cx={0} cy={0} r={R} fill={`url(#${surfaceId})`} />
          <circle cx={0} cy={0} r={R} fill={`url(#${shadowId})`} />
          <ellipse
            cx={-84}
            cy={-116}
            rx={128}
            ry={48}
            fill="rgba(232, 240, 255, 0.16)"
            transform="rotate(-18 -84 -116)"
            className="globe-surface-highlight"
          />
          <g clipPath={`url(#${clipId})`} mask={`url(#${edgeMaskId})`}>
            {parallelPaths.map(({ d, equator }, i) =>
              d ? (
                <path
                  key={`p-${i}`}
                  d={d}
                  stroke={
                    equator
                      ? "rgba(220, 234, 255, 0.62)"
                      : "rgba(174, 199, 255, 0.30)"
                  }
                  strokeWidth={equator ? 1.25 : 0.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#${glowId})`}
                />
              ) : null
            )}

            {meridianPaths.map((d, i) =>
              d ? (
                <path
                  key={`m-${i}`}
                  d={d}
                  stroke="rgba(196, 214, 255, 0.34)"
                  strokeWidth={0.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter={`url(#${glowId})`}
                />
              ) : null
            )}
          </g>

          {scanPath && (
            <path
              d={scanPath}
              stroke={`url(#${scanId})`}
              strokeWidth={activity === "active" ? 1.4 : 1.1}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${glowId})`}
              mask={`url(#${edgeMaskId})`}
              className="globe-scan-line"
            />
          )}
        </svg>
      </div>
    </div>
  );
}
