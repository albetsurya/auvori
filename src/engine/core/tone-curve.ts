import { ToneCurveConfig } from '../../types';

export interface ToneCurveKnots {
  y: [number, number, number, number, number];
  m: [number, number, number, number, number];
}

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const NEUTRAL_TONE_CURVE: ToneCurveConfig = {
  blackPoint: 0,
  shadowPivot: 0,
  midtonePivot: 0,
  highlightShoulder: 0,
  whitePoint: 1
};

export function isNeutralToneCurve(curve: ToneCurveConfig | undefined): boolean {
  if (!curve) return true;
  return (
    Math.abs(curve.blackPoint) < 1e-4 &&
    Math.abs(curve.shadowPivot) < 1e-4 &&
    Math.abs(curve.midtonePivot) < 1e-4 &&
    Math.abs(curve.highlightShoulder) < 1e-4 &&
    Math.abs(curve.whitePoint - 1) < 1e-4
  );
}

/**
 * Scales a ToneCurveConfig smoothly by blend weight k in [0, 1].
 * At k = 0 returns undefined (identity). At k = 1 returns full curve.
 */
export function scaleToneCurve(
  curve: ToneCurveConfig | undefined,
  k: number
): ToneCurveConfig | undefined {
  if (!curve || k <= 1e-4) return undefined;
  const scaled: ToneCurveConfig = {
    blackPoint: curve.blackPoint * k,
    shadowPivot: curve.shadowPivot * k,
    midtonePivot: curve.midtonePivot * k,
    highlightShoulder: curve.highlightShoulder * k,
    whitePoint: 1 + (curve.whitePoint - 1) * k
  };
  return isNeutralToneCurve(scaled) ? undefined : scaled;
}

/**
 * Builds Fritsch-Carlson Monotone Cubic Hermite knots on fixed x = [0, 0.25, 0.5, 0.75, 1.0].
 * Enforces strict knot ordering and tangent clamping so f(x) is guaranteed C1-smooth
 * and monotonically non-decreasing across [0, 1] for all valid ToneCurveConfig values.
 */
export function buildMonotoneToneCurveKnots(curve: ToneCurveConfig): ToneCurveKnots {
  const y0 = clamp(curve.blackPoint, 0, 0.25);
  const y4 = clamp(curve.whitePoint, Math.max(y0 + 0.08, 0.8), 1.0);
  const span = y4 - y0;
  const eps = 0.015;

  const rawY1 = y0 + 0.25 * span + clamp(curve.shadowPivot, -0.18, 0.18);
  const rawY2 = y0 + 0.5 * span + clamp(curve.midtonePivot, -0.18, 0.18);
  const rawY3 = y0 + 0.75 * span - clamp(curve.highlightShoulder, 0, 0.28) * 0.45;

  const y1 = clamp(rawY1, y0 + eps, y4 - 3 * eps);
  const y2 = clamp(rawY2, y1 + eps, y4 - 2 * eps);
  const y3 = clamp(rawY3, y2 + eps, y4 - eps);

  const y: [number, number, number, number, number] = [y0, y1, y2, y3, y4];
  const d: [number, number, number, number] = [
    (y1 - y0) * 4,
    (y2 - y1) * 4,
    (y3 - y2) * 4,
    (y4 - y3) * 4
  ];

  const m: [number, number, number, number, number] = [
    d[0],
    0.5 * (d[0] + d[1]),
    0.5 * (d[1] + d[2]),
    0.5 * (d[2] + d[3]),
    d[3]
  ];

  // Fritsch-Carlson tangent radius clamping guarantees strict monotonicity
  for (let k = 0; k < 4; k++) {
    const dk = d[k];
    if (dk <= 1e-6) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const alpha = m[k] / dk;
    const beta = m[k + 1] / dk;
    const sq = alpha * alpha + beta * beta;
    if (sq > 9) {
      const tau = 3 / Math.sqrt(sq);
      m[k] = tau * alpha * dk;
      m[k + 1] = tau * beta * dk;
    }
  }

  return { y, m };
}

/**
 * Evaluates Fritsch-Carlson cubic Hermite spline at x in [0, 1].
 * Matches GLSL `evalToneCurve` bit-for-bit.
 */
export function evalMonotoneToneCurve(x: number, knots: ToneCurveKnots): number {
  const xc = x < 0 ? 0 : x > 1 ? 1 : x;
  const k = xc >= 0.75 ? 3 : xc >= 0.5 ? 2 : xc >= 0.25 ? 1 : 0;
  const t = (xc - k * 0.25) * 4;
  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const val =
    h00 * knots.y[k] +
    h10 * 0.25 * knots.m[k] +
    h01 * knots.y[k + 1] +
    h11 * 0.25 * knots.m[k + 1];

  return val < 0 ? 0 : val > 1 ? 1 : val;
}
