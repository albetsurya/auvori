import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom'
});

const acc = await vite.ssrLoadModule('/src/engine/adaptive-color/index.ts');

test.after(async () => {
  await vite.close();
});

function makeSolidBuffer(w, h, r, g, b, a = 255) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4;
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
    buf[o + 3] = a;
  }
  return buf;
}

function makeSyntheticScene(w, h, fn) {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x / Math.max(1, w - 1), y / Math.max(1, h - 1), x, y);
      const o = (y * w + x) * 4;
      buf[o] = Math.max(0, Math.min(255, Math.round(r)));
      buf[o + 1] = Math.max(0, Math.min(255, Math.round(g)));
      buf[o + 2] = Math.max(0, Math.min(255, Math.round(b)));
      buf[o + 3] = Math.max(0, Math.min(255, Math.round(a)));
    }
  }
  return buf;
}

test('1. Exposure analysis handles sRGB->Linear and detects under/over/balanced scenes', () => {
  const dark = makeSolidBuffer(64, 64, 32, 32, 32);
  const mid = makeSolidBuffer(64, 64, 128, 128, 128);
  const bright = makeSolidBuffer(64, 64, 240, 240, 240);

  const aDark = acc.analyzeImageRgba(dark, 64, 64);
  const aMid = acc.analyzeImageRgba(mid, 64, 64);
  const aBright = acc.analyzeImageRgba(bright, 64, 64);

  assert.ok(aDark.exposure.meanLuminance < 0.16);
  assert.ok(aDark.exposure.meanLuminanceLinear < 0.03);
  assert.ok(aDark.exposure.underexposedRatio > 0.9);

  // Mid-gray sRGB 128/255 ~= 0.502, linear ~= 0.216 (NOT 0.502!)
  assert.ok(Math.abs(aMid.exposure.meanLuminance - 0.502) < 0.03);
  assert.ok(Math.abs(aMid.exposure.meanLuminanceLinear - 0.216) < 0.02);

  assert.ok(aBright.exposure.overexposedRatio > 0.9);
  assert.ok(aBright.exposure.meanLuminance > 0.9);
});

test('2. Histogram calculations normalize to ~1.0 and track percentiles & channel clipping', () => {
  const grad = makeSyntheticScene(128, 64, (u) => {
    const v = u * 255;
    return [v, v * 0.8, v * 0.5];
  });
  const report = acc.analyzeImageRgba(grad, 128, 64);
  let sumLum = 0;
  for (let i = 0; i < report.histogram.bins; i++) sumLum += report.histogram.luminance[i];
  assert.ok(Math.abs(sumLum - 1) < 1e-4, `histogram sum was ${sumLum}`);
  assert.ok(report.histogram.percentiles.p10 < report.histogram.percentiles.p50);
  assert.ok(report.histogram.percentiles.p50 < report.histogram.percentiles.p90);
  assert.ok(report.histogram.channelClipping.r > report.histogram.channelClipping.b);
});

test('3. White balance estimation detects warm vs cool vs green casts conservatively', () => {
  const warmNeutral = makeSyntheticScene(96, 96, (u, v) => {
    const base = 90 + (u * 0.5 + v * 0.5) * 110;
    return [base * 1.18, base * 1.0, base * 0.72];
  });
  const coolNeutral = makeSyntheticScene(96, 96, (u, v) => {
    const base = 90 + (u * 0.5 + v * 0.5) * 110;
    return [base * 0.76, base * 0.96, base * 1.18];
  });
  const greenCast = makeSyntheticScene(96, 96, (u, v) => {
    const base = 90 + (u * 0.5 + v * 0.5) * 110;
    return [base * 0.90, base * 1.15, base * 0.92];
  });

  const resWarm = acc.analyzeAndSolveAdaptiveColorFromRgba(warmNeutral, 96, 96);
  const resCool = acc.analyzeAndSolveAdaptiveColorFromRgba(coolNeutral, 96, 96);
  const resGreen = acc.analyzeAndSolveAdaptiveColorFromRgba(greenCast, 96, 96);

  assert.ok(resWarm.analysis.whiteBalance.estimatedWarmCast > 0.1);
  assert.ok(resWarm.parameters.temperature < -0.02);

  assert.ok(resCool.analysis.whiteBalance.estimatedWarmCast < -0.1);
  assert.ok(resCool.parameters.temperature > 0.02);

  assert.ok(resGreen.analysis.whiteBalance.estimatedTintCast < -0.1);
  assert.ok(resGreen.parameters.tint > 0.02);
});

test('4. Saturation analysis distinguishes muted vs oversaturated vs monochrome', () => {
  const muted = makeSyntheticScene(64, 64, (u) => {
    const base = 110 + u * 40;
    return [base + 12, base + 4, base - 10];
  });
  const oversat = makeSyntheticScene(64, 64, (u) => {
    return u < 0.5 ? [245, 25, 20] : [20, 40, 245];
  });
  const mono = makeSyntheticScene(64, 64, (u) => {
    const g = 30 + u * 200;
    return [g, g, g];
  });

  const resMuted = acc.analyzeAndSolveAdaptiveColorFromRgba(muted, 64, 64);
  const resOversat = acc.analyzeAndSolveAdaptiveColorFromRgba(oversat, 64, 64);
  const resMono = acc.analyzeAndSolveAdaptiveColorFromRgba(mono, 64, 64);

  assert.ok(resMuted.parameters.vibrance > 0.05);
  assert.ok(resOversat.parameters.saturation < -0.05);
  assert.equal(resMono.analysis.color.isMonochrome, true);
  assert.equal(resMono.parameters.temperature, 0);
  assert.equal(resMono.parameters.tint, 0);
  assert.equal(resMono.parameters.saturation, 0);
  assert.equal(resMono.parameters.vibrance, 0);
  assert.equal(resMono.parameters.greenCorrection, 0);
});

test('5. Green foliage analysis activates only when significant green foliage exists', () => {
  const neonFoliage = makeSyntheticScene(96, 96, (u, v) => {
    const sky = v < 0.35;
    if (sky) return [130, 175, 225];
    return [30 + u * 30, 200 + v * 35, 35];
  });
  const noGreen = makeSyntheticScene(96, 96, (u, v) => [175 - u * 40, 120 + v * 20, 105]);

  const resGreen = acc.analyzeAndSolveAdaptiveColorFromRgba(neonFoliage, 96, 96);
  const resNoGreen = acc.analyzeAndSolveAdaptiveColorFromRgba(noGreen, 96, 96);

  assert.ok(resGreen.analysis.color.greenFoliageRatio > 0.3);
  assert.ok(resGreen.parameters.greenCorrection > 0.25);
  assert.equal(resNoGreen.parameters.greenCorrection, 0);
});

test('6. Skin-tone confidence detects coherent portrait skin and ignores monochrome/non-skin', () => {
  const portrait = makeSyntheticScene(96, 96, (u, v) => {
    const d = Math.hypot((u - 0.5) / 0.25, (v - 0.45) / 0.3);
    if (d < 1) return [214, 165, 138]; // natural skin tone
    return [75, 95, 110]; // cool backdrop
  });
  const forest = makeSyntheticScene(96, 96, (u, v) => [45 + u * 20, 130 + v * 40, 48]);

  const resPortrait = acc.analyzeAndSolveAdaptiveColorFromRgba(portrait, 96, 96);
  const resForest = acc.analyzeAndSolveAdaptiveColorFromRgba(forest, 96, 96);

  assert.ok(resPortrait.analysis.skin.confidence > 0.45);
  assert.ok(resForest.analysis.skin.confidence < 0.1);
});

test('7. Validator enforces configurable bounds and handles NaN/Inf safely', () => {
  const report = acc.analyzeImageRgba(makeSolidBuffer(32, 32, 128, 128, 128), 32, 32);
  const validated = acc.validateAdaptiveCorrections(
    {
      exposure: Number.NaN,
      highlights: -999,
      shadows: Infinity,
      contrast: 50,
      temperature: -99,
      tint: 99,
      vibrance: 99,
      saturation: 99,
      greenCorrection: 99,
      blackPoint: -99,
      whitePoint: 99
    },
    report
  );

  const b = acc.ADAPTIVE_COLOR_BOUNDS;
  const p = validated.parameters;
  assert.equal(Number.isFinite(p.exposure), true);
  assert.ok(p.highlights >= b.highlights[0] && p.highlights <= b.highlights[1]);
  assert.ok(p.shadows >= b.shadows[0] && p.shadows <= b.shadows[1]);
  assert.ok(p.contrast >= b.contrast[0] && p.contrast <= b.contrast[1]);
  assert.ok(p.temperature >= b.temperature[0] && p.temperature <= b.temperature[1]);
  assert.ok(p.tint >= b.tint[0] && p.tint <= b.tint[1]);
  assert.ok(p.vibrance >= b.vibrance[0] && p.vibrance <= b.vibrance[1]);
  assert.ok(p.saturation >= b.saturation[0] && p.saturation <= b.saturation[1]);
  assert.ok(p.greenCorrection >= b.greenCorrection[0] && p.greenCorrection <= b.greenCorrection[1]);
  assert.ok(p.blackPoint >= b.blackPoint[0] && p.blackPoint <= b.blackPoint[1]);
  assert.ok(p.whitePoint >= b.whitePoint[0] && p.whitePoint <= b.whitePoint[1]);
  assert.ok(validated.warnings.includes('parameter-bounds-clamped'));
});

test('8. Strength blending: 0% is bit-exact original, 50% lies monotonically between 0% and 100%', () => {
  const scene = makeSyntheticScene(64, 64, (u, v) => [55 + u * 40, 42 + v * 35, 38 + u * 25]);
  const res = acc.analyzeAndSolveAdaptiveColorFromRgba(scene, 64, 64);

  const p0 = acc.toAdaptiveColorRenderParams(res.parameters, 0);
  assert.equal(p0, undefined);

  const p25 = acc.toAdaptiveColorRenderParams(res.parameters, 25);
  const p50 = acc.toAdaptiveColorRenderParams(res.parameters, 50);
  const p75 = acc.toAdaptiveColorRenderParams(res.parameters, 75);
  const p100 = acc.toAdaptiveColorRenderParams(res.parameters, 100);
  assert.ok(p25 && p50 && p75 && p100);

  const [r0, g0, b0] = acc.applyAdaptiveColorToPixel(0.3, 0.25, 0.22, { ...res.parameters, strength: 0 });
  assert.equal(r0, 0.3);
  assert.equal(g0, 0.25);
  assert.equal(b0, 0.22);

  const [r25] = acc.applyAdaptiveColorToPixel(0.3, 0.25, 0.22, p25);
  const [r50] = acc.applyAdaptiveColorToPixel(0.3, 0.25, 0.22, p50);
  const [r75] = acc.applyAdaptiveColorToPixel(0.3, 0.25, 0.22, p75);
  const [r100] = acc.applyAdaptiveColorToPixel(0.3, 0.25, 0.22, p100);

  assert.ok(r0 <= r25 && r25 <= r50 && r50 <= r75 && r75 <= r100);
});

test('9. Deterministic output: identical inputs produce bit-exact identical parameters and pixels', () => {
  const scene = makeSyntheticScene(80, 80, (u, v) => [80 + u * 110, 95 + v * 90, 70 + (1 - u) * 80]);
  const r1 = acc.analyzeAndSolveAdaptiveColorFromRgba(scene, 80, 80);
  const r2 = acc.analyzeAndSolveAdaptiveColorFromRgba(scene, 80, 80);
  assert.deepEqual(r1.parameters, r2.parameters);
  assert.deepEqual(r1.confidence, r2.confidence);

  const buf1 = new Uint8ClampedArray(scene);
  const buf2 = new Uint8ClampedArray(scene);
  const rp = acc.toAdaptiveColorRenderParams(r1.parameters, 80);
  acc.applyAdaptiveColorToBuffer(buf1, 80, 80, rp);
  acc.applyAdaptiveColorToBuffer(buf2, 80, 80, rp);
  assert.deepEqual(buf1, buf2);
});

test('10. Invalid, empty, and fully transparent inputs degrade gracefully without NaN', () => {
  const emptyRes = acc.analyzeAndSolveAdaptiveColorFromRgba(new Uint8ClampedArray(0), 0, 0);
  assert.equal(emptyRes.confidence.overall, 0);
  assert.equal(emptyRes.parameters.exposure, 0);

  const transparent = makeSolidBuffer(32, 32, 200, 100, 50, 0);
  const transRes = acc.analyzeAndSolveAdaptiveColorFromRgba(transparent, 32, 32);
  assert.equal(transRes.confidence.overall, 0);
  assert.ok(transRes.warnings.includes('empty-or-transparent-image'));

  // Alpha channel preserved during buffer rendering
  const semi = makeSolidBuffer(16, 16, 60, 70, 80, 123);
  const rp = acc.toAdaptiveColorRenderParams({ ...acc.NEUTRAL_ADAPTIVE_PARAMETERS, exposure: 0.4 }, 100);
  acc.applyAdaptiveColorToBuffer(semi, 16, 16, rp);
  assert.equal(semi[3], 123);
});

test('11. Scenario matrix: different scenarios produce distinct, appropriate corrections', () => {
  const underPortrait = makeSyntheticScene(96, 96, (u, v) => {
    const d = Math.hypot((u - 0.5) / 0.25, (v - 0.45) / 0.3);
    return d < 1 ? [86, 64, 52] : [26, 30, 34];
  });
  const overexposed = makeSyntheticScene(96, 96, (u, v) => [
    225 + u * 28,
    220 + v * 30,
    210 + u * 35
  ]);
  const highContrast = makeSyntheticScene(96, 96, (u) => (u < 0.45 ? [8, 8, 10] : u > 0.55 ? [246, 244, 240] : [130, 128, 124]));
  const darkCinematic = makeSyntheticScene(96, 96, (u, v) => {
    const lamp = Math.hypot(u - 0.8, v - 0.2) < 0.14;
    if (lamp) return [248, 220, 165];
    return [18 + u * 18, 20 + v * 16, 28 + u * 12];
  });

  const pUnder = acc.analyzeAndSolveAdaptiveColorFromRgba(underPortrait, 96, 96);
  const pOver = acc.analyzeAndSolveAdaptiveColorFromRgba(overexposed, 96, 96);
  const pHighC = acc.analyzeAndSolveAdaptiveColorFromRgba(highContrast, 96, 96);
  const pDarkCin = acc.analyzeAndSolveAdaptiveColorFromRgba(darkCinematic, 96, 96);

  // Underexposed gets positive exposure & shadows
  assert.ok(pUnder.parameters.exposure > 0.15);
  assert.ok(pUnder.parameters.shadows > 0.15);

  // Overexposed gets negative exposure & highlights (not positive exposure!)
  assert.ok(pOver.parameters.exposure < -0.15);
  assert.ok(pOver.parameters.highlights < -0.15);

  // High-contrast avoids positive contrast push
  assert.ok(pHighC.parameters.contrast <= 0.02);

  // Dark cinematic preserves moody dark look (much less brightening than truly underexposed)
  assert.equal(pDarkCin.analysis.exposure.isLowKeyCinematic, true);
  assert.ok(pDarkCin.parameters.exposure < pUnder.parameters.exposure);
});
