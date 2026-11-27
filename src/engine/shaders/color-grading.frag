#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSourceTex;
uniform sampler2D uMaskTex;
uniform sampler2D uBokehTex;

uniform ivec2 uSize;
uniform ivec2 uMaskSize;
uniform ivec2 uBokehSize;
uniform int uHasMask;
uniform int uHasBokeh;
uniform int uHasHsl;
uniform int uIncludeGrain;
uniform int uApplyFinalStages;

uniform float uDehazeK;
uniform float uExpMult;
uniform float uContrastAmt;
uniform float uHlFactor;
uniform float uShFactor;
uniform float uWhiteFactor;
uniform float uBlackFactor;

uniform float uTempR;
uniform float uTempB;
uniform float uTintG;
uniform float uTintRB;

uniform float uSatMult;
uniform float uVibFactor;
uniform float uSCyan;
uniform float uSWarm;
uniform float uSkinBoost;
uniform float uRosyAmt;
uniform float uBgDarkAmt;
uniform float uBokehAmtScale;
uniform float uFadeLift;
uniform float uGrainAmt;
uniform float uVigStrength;

// 6-band HSL adjustments stored as vec3(h, s, l)
uniform vec3 uHslRed;
uniform vec3 uHslOrange;
uniform vec3 uHslYellow;
uniform vec3 uHslGreen;
uniform vec3 uHslAqua;
uniform vec3 uHslBlue;

// P1 Signature Tone Curve (5-knot Fritsch-Carlson Monotone Cubic Hermite)
uniform int uHasToneCurve;
uniform float uCurveY[5];
uniform float uCurveM[5];

// P1 Three-Way Color Grading
uniform int uHasColorGrading;
uniform vec3 uCgShadow;
uniform vec3 uCgMidtone;
uniform vec3 uCgHighlight;
uniform float uCgBalance;

float clamp01(float v) {
  return clamp(v, 0.0, 1.0);
}

float softHighlightRoll(float v) {
  if (v <= 0.0) return 0.0;
  if (v <= 0.84) return v;
  float t = (v - 0.84) / 0.16;
  return 0.84 + 0.16 * (t / (1.0 + t));
}

vec3 softHighlightRoll3(vec3 c) {
  return vec3(
    softHighlightRoll(c.r),
    softHighlightRoll(c.g),
    softHighlightRoll(c.b)
  );
}

float evalToneCurve(float x) {
  float xc = clamp01(x);
  float y0, y1, m0, m1, kStart;
  if (xc >= 0.75) {
    kStart = 0.75;
    y0 = uCurveY[3]; y1 = uCurveY[4];
    m0 = uCurveM[3]; m1 = uCurveM[4];
  } else if (xc >= 0.5) {
    kStart = 0.5;
    y0 = uCurveY[2]; y1 = uCurveY[3];
    m0 = uCurveM[2]; m1 = uCurveM[3];
  } else if (xc >= 0.25) {
    kStart = 0.25;
    y0 = uCurveY[1]; y1 = uCurveY[2];
    m0 = uCurveM[1]; m1 = uCurveM[2];
  } else {
    kStart = 0.0;
    y0 = uCurveY[0]; y1 = uCurveY[1];
    m0 = uCurveM[0]; m1 = uCurveM[1];
  }

  float t = (xc - kStart) * 4.0;
  float t2 = t * t;
  float t3 = t2 * t;
  float h00 = 2.0 * t3 - 3.0 * t2 + 1.0;
  float h10 = t3 - 2.0 * t2 + t;
  float h01 = -2.0 * t3 + 3.0 * t2;
  float h11 = t3 - t2;

  return clamp01(h00 * y0 + h10 * 0.25 * m0 + h01 * y1 + h11 * 0.25 * m1);
}

float computeSkinWeight(vec3 c) {
  float y = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  if (y <= 0.14 || c.r <= 0.16) return 0.0;

  float cb = 0.5 - 0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b;
  float cr = 0.5 + 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b;

  float lumW = smoothstep(0.2, 0.36, y);
  float cbW = smoothstep(0.32, 0.375, cb) * (1.0 - smoothstep(0.475, 0.515, cb));
  float crW = smoothstep(0.51, 0.548, cr) * (1.0 - smoothstep(0.66, 0.72, cr));
  float sepW = smoothstep(0.045, 0.095, cr - cb);

  return lumW * cbW * crW * sepW;
}

float hue2rgb(float p, float q, float t) {
  float tt = t;
  if (tt < 0.0) tt += 1.0;
  if (tt > 1.0) tt -= 1.0;
  if (tt < 1.0 / 6.0) return p + (q - p) * 6.0 * tt;
  if (tt < 0.5) return q;
  if (tt < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - tt) * 6.0;
  return p;
}

vec3 applyHslMix(vec3 c) {
  float r = c.r;
  float g = c.g;
  float b = c.b;
  float maxC = max(r, max(g, b));
  float minC = min(r, min(g, b));
  float d = maxC - minC;
  if (d < 1e-5) return c;

  float l = (maxC + minC) * 0.5;
  float s = l > 0.5 ? d / max(1e-5, 2.0 - maxC - minC) : d / max(1e-5, maxC + minC);

  float guard = smoothstep(0.025, 0.13, s) * smoothstep(0.04, 0.14, l) * (1.0 - smoothstep(0.9, 0.98, l));
  if (guard <= 0.001) return c;

  float h6 = 0.0;
  if (maxC == r) h6 = mod((g - b) / d, 6.0);
  else if (maxC == g) h6 = (b - r) / d + 2.0;
  else h6 = (r - g) / d + 4.0;
  if (h6 < 0.0) h6 += 6.0;
  float hue = h6 * 60.0;

  vec3 b0 = vec3(0.0);
  vec3 b1 = vec3(0.0);
  float t = 0.0;

  if (hue < 28.0) {
    b0 = uHslRed;
    b1 = uHslOrange;
    t = smoothstep(0.0, 28.0, hue);
  } else if (hue < 58.0) {
    b0 = uHslOrange;
    b1 = uHslYellow;
    t = smoothstep(28.0, 58.0, hue);
  } else if (hue < 115.0) {
    b0 = uHslYellow;
    b1 = uHslGreen;
    t = smoothstep(58.0, 115.0, hue);
  } else if (hue < 180.0) {
    b0 = uHslGreen;
    b1 = uHslAqua;
    t = smoothstep(115.0, 180.0, hue);
  } else if (hue < 235.0) {
    b0 = uHslAqua;
    b1 = uHslBlue;
    t = smoothstep(180.0, 235.0, hue);
  } else if (hue < 295.0) {
    b0 = uHslBlue;
    b1 = vec3(0.0);
    t = smoothstep(235.0, 295.0, hue);
  } else {
    b0 = vec3(0.0);
    b1 = uHslRed;
    t = smoothstep(322.0, 360.0, hue);
  }

  vec3 adj = mix(b0, b1, t);
  if (abs(adj.x) < 0.02 && abs(adj.y) < 0.02 && abs(adj.z) < 0.02) {
    return c;
  }

  float hNew = mod(hue + adj.x * 0.72 * guard, 360.0);
  if (hNew < 0.0) hNew += 360.0;

  float sNew = clamp01(s * (1.0 + (adj.y / 55.0) * guard));
  float lNew = l;
  if (adj.z > 0.0) {
    lNew = clamp01(l + (adj.z / 100.0) * 0.3 * guard * (0.35 + 0.65 * (1.0 - l)));
  } else if (adj.z < 0.0) {
    lNew = clamp01(l * (1.0 + (adj.z / 100.0) * 0.56 * guard));
  }

  if (sNew < 1e-5) return vec3(lNew);

  float q = lNew < 0.5 ? lNew * (1.0 + sNew) : lNew + sNew - lNew * sNew;
  float p = 2.0 * lNew - q;
  float hk = hNew / 360.0;

  return vec3(
    hue2rgb(p, q, hk + 1.0 / 3.0),
    hue2rgb(p, q, hk),
    hue2rgb(p, q, hk - 1.0 / 3.0)
  );
}

float samplePortraitMask(vec2 uv) {
  vec2 fSize = vec2(uMaskSize);
  vec2 aligned = (clamp(uv, 0.0, 1.0) * (fSize - 1.0) + 0.5) / fSize;
  return texture(uMaskTex, aligned).r;
}

vec3 sampleBokehRgb(vec2 uv) {
  vec2 fSize = vec2(uBokehSize);
  vec2 aligned = (clamp(uv, 0.0, 1.0) * (fSize - 1.0) + 0.5) / fSize;
  return texture(uBokehTex, aligned).rgb;
}

void main() {
  int x = int(gl_FragCoord.x);
  int y = int(gl_FragCoord.y);
  vec4 src = texelFetch(uSourceTex, ivec2(x, y), 0);
  vec3 rgb = src.rgb;

  float invW = 1.0 / float(uSize.x);
  float invH = 1.0 / float(uSize.y);
  float nx = (float(x) + 0.5) * invW;
  float ny = (float(y) + 0.5) * invH;
  float depthFade = 1.0 - 0.78 * smoothstep(0.68, 0.94, ny);

  float subj = 1.0;
  float effBgMask = 0.0;
  if (uHasMask == 1) {
    subj = samplePortraitMask(vec2(nx, ny));
    effBgMask = (1.0 - subj) * depthFade;
  }

  // 0c. Optical bokeh blend on background
  if (uHasBokeh == 1 && effBgMask > 0.18) {
    vec3 bokehRgb = sampleBokehRgb(vec2(nx, ny));
    float bMix = min(1.0, uBokehAmtScale * smoothstep(0.18, 0.86, effBgMask));
    rgb += (bokehRgb - rgb) * bMix;
  }

  // 1. Smooth Dehaze (monotonic toe curve in [0, 1])
  if (uDehazeK > 0.0) {
    vec3 om = 1.0 - rgb;
    rgb *= 1.0 - uDehazeK * om * om;
  }

  // 2. Exposure with soft highlight rolloff
  if (uExpMult != 1.0) {
    rgb = softHighlightRoll3(rgb * uExpMult);
  }

  // 3. Luminance-aware Highlights, Shadows, Whites, Blacks
  float lum = clamp01(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
  if (uShFactor != 0.0 && lum > 1e-4) {
    float shadowMask = (1.0 - lum) * (1.0 - lum);
    if (uShFactor > 0.0) {
      float lift = uShFactor * 0.24 * sqrt(lum) * shadowMask;
      float scale = (lum + lift) / lum;
      rgb = softHighlightRoll3(rgb * scale);
    } else {
      float drop = 1.0 + uShFactor * 0.34 * shadowMask;
      rgb *= drop;
    }
  }
  if (uHlFactor != 0.0) {
    float hlMask = lum * lum;
    if (uHlFactor < 0.0) {
      float pull = 1.0 + uHlFactor * 0.36 * hlMask;
      rgb *= pull;
    } else {
      float lift = uHlFactor * 0.16 * hlMask;
      rgb = softHighlightRoll3(rgb + lift);
    }
  }
  if (uWhiteFactor != 0.0) {
    float wMask = smoothstep(0.45, 1.0, lum);
    if (uWhiteFactor > 0.0) {
      float add = uWhiteFactor * 0.14 * wMask;
      rgb = softHighlightRoll3(rgb + add);
    } else {
      float pull = 1.0 + uWhiteFactor * 0.25 * wMask;
      rgb *= pull;
    }
  }
  if (uBlackFactor != 0.0) {
    float bMask = (1.0 - lum) * (1.0 - lum);
    if (uBlackFactor < 0.0) {
      float drop = 1.0 + uBlackFactor * 0.58 * bMask;
      rgb *= drop;
    } else {
      float lift = uBlackFactor * 0.14 * bMask * (1.0 - lum);
      rgb = clamp(rgb + lift, 0.0, 1.0);
    }
  }

  // 4. Smooth Monotonic S-Curve Contrast
  if (uContrastAmt != 0.0) {
    float k = uContrastAmt * 1.6;
    rgb = clamp(rgb + k * rgb * (1.0 - rgb) * (2.0 * rgb - 1.0), 0.0, 1.0);
  }

  // 4b. Monotonic Cubic Tone Curve (Signature Looks)
  if (uHasToneCurve == 1) {
    vec3 cRgb = vec3(evalToneCurve(rgb.r), evalToneCurve(rgb.g), evalToneCurve(rgb.b));
    float cLum = clamp01(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
    float tLum = evalToneCurve(cLum);
    float ratio = cLum > 1e-4 ? tLum / cLum : 1.0;
    vec3 lRgb = clamp(rgb * ratio, 0.0, 1.0);
    float preSkin = computeSkinWeight(rgb);
    float lumaMix = 0.22 + preSkin * 0.48;
    rgb = mix(cRgb, lRgb, lumaMix);
  }

  // 5. 6-Band HSL Color Mix
  if (uHasHsl == 1) {
    rgb = applyHslMix(rgb);
  }

  float skinWeight = computeSkinWeight(rgb);
  lum = clamp01(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);

  // 6. Portrait-aware Background Darkening
  if (uBgDarkAmt > 0.0 && uHasMask == 1) {
    if (effBgMask > 0.01) {
      float bgExposure = 1.0 - uBgDarkAmt * 0.62 * effBgMask;
      float bgHighlightTame = 1.0 - uBgDarkAmt * 0.26 * effBgMask * smoothstep(0.38, 0.92, lum);
      rgb *= (bgExposure * bgHighlightTame);

      float bgGray = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
      float bgDesat = uBgDarkAmt * effBgMask * 0.28;
      rgb += (vec3(bgGray) - rgb) * bgDesat;
    }
    if (subj > 0.15) {
      float pop = 1.0 + uBgDarkAmt * 0.06 * subj * (1.0 - lum * 0.5);
      rgb = softHighlightRoll3(rgb * pop);
    }
  }

  // 7. White Balance (skin & darkened background protected)
  float wbScale = (1.0 - skinWeight * (0.45 + uRosyAmt * 0.22)) * (1.0 - uBgDarkAmt * effBgMask * 0.5);
  rgb = clamp(rgb + vec3(uTempR + uTintRB, uTintG, uTempB + uTintRB) * wbScale, 0.0, 1.0);

  // 8. Split-toning (guarded away from pure black & skin tones)
  float shadowToneGuard = smoothstep(0.02, 0.14, lum);
  float shadowWeight = pow(max(1e-5, 1.0 - lum), 1.35) * (1.0 - skinWeight * 0.72) * shadowToneGuard;
  if (uSCyan > 0.0) {
    rgb = clamp(rgb + vec3(-uSCyan * 0.52, uSCyan * 0.3, uSCyan * 0.58) * shadowWeight, 0.0, 1.0);
  }
  if (uSWarm > 0.0) {
    rgb = clamp(rgb + vec3(uSWarm * 0.52, uSWarm * 0.22, -uSWarm * 0.42) * shadowWeight, 0.0, 1.0);
  }

  // 8b. 3-Way Color Grading
  if (uHasColorGrading == 1) {
    float cgLum = clamp01(0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b);
    float pivot = 0.5 + uCgBalance * 0.25;
    float darkGuard = smoothstep(0.015, 0.1, cgLum);
    float hlGuard = 1.0 - smoothstep(0.95, 1.0, cgLum);
    float wSh = (1.0 - smoothstep(0.05, pivot + 0.15, cgLum)) * darkGuard;
    float wHl = smoothstep(max(0.15, pivot - 0.15), 0.94, cgLum) * hlGuard;
    float wMid = 4.0 * cgLum * (1.0 - cgLum) * (1.0 - skinWeight * 0.45);
    rgb = softHighlightRoll3(clamp(rgb + wSh * uCgShadow + wMid * uCgMidtone + wHl * uCgHighlight, 0.0, 1.0));
  }

  // 9. Clean Skin Brightening & Healthy Rosy Flush ("Wajah Merona")
  if (skinWeight > 0.0) {
    if (uSkinBoost > 0.0) {
      float hlProtect = 1.0 - 0.58 * smoothstep(0.62, 0.94, lum);
      float boost = uSkinBoost * skinWeight * hlProtect;
      rgb = softHighlightRoll3(rgb + vec3(boost * 0.98, boost * 0.96, boost * 0.95));
    }

    if (uRosyAmt > 0.0) {
      float midWeight = max(0.25, 4.0 * lum * (1.0 - lum));
      float hlRoll = 1.0 - 0.55 * smoothstep(0.68, 0.96, lum);
      float rw = skinWeight * uRosyAmt * hlRoll;

      float lift = 0.065 * rw * (1.0 - lum * 0.65);
      float yellowCast = max(0.0, rgb.g - rgb.b);
      float bDeYellow = yellowCast * 0.3 * rw;

      float naturalWarmth = smoothstep(0.09, 0.23, rgb.r - rgb.g);
      float blushLift = (0.012 + 0.044 * naturalWarmth) * rw * midWeight;

      rgb = softHighlightRoll3(vec3(
        rgb.r + lift + blushLift * 1.12,
        rgb.g + lift * 0.97 - blushLift * 0.28,
        rgb.b + lift + bDeYellow + blushLift * 0.32
      ));
    }
  }

  // 10. Bounded Saturation & Vibrance
  rgb = clamp(rgb, 0.0, 1.0);
  if (uSatMult != 1.0 || uVibFactor != 0.0) {
    float gray = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    float maxC = max(rgb.r, max(rgb.g, rgb.b));
    float minC = min(rgb.r, min(rgb.g, rgb.b));
    float curSat = maxC > 1e-5 ? (maxC - minC) / maxC : 0.0;
    float darkGuard = smoothstep(0.03, 0.14, gray);
    float bgCalm = 1.0 - uBgDarkAmt * effBgMask * 0.85;
    float vibBoost = uVibFactor * (1.0 - curSat) * (1.0 - skinWeight * 0.42) * darkGuard * bgCalm;
    float effSat = max(0.0, uSatMult * (1.0 + vibBoost));
    rgb = clamp(vec3(gray) + (rgb - vec3(gray)) * effSat, 0.0, 1.0);
  }

  if (uApplyFinalStages == 1) {
    // 11. Matte Film Fade
    if (uFadeLift > 0.0) {
      float scale = 1.0 - uFadeLift;
      rgb = rgb * scale + uFadeLift;
    }

    // 12. Soft Vignette
    if (uVigStrength > 0.0) {
      vec2 halfSize = vec2(uSize) * 0.5;
      vec2 d = vec2(float(x), float(y)) - halfSize;
      float invMaxDistSq = 1.0 / (halfSize.x * halfSize.x + halfSize.y * halfSize.y);
      float distNorm = min(1.0, dot(d, d) * invMaxDistSq);
      float vFactor = 1.0 - uVigStrength * 0.58 * pow(max(1e-5, distNorm), 1.15);
      rgb *= vFactor;
    }

    // 13. Midtone-weighted 2D spatial film grain (exact 32-bit unsigned integer hash parity)
    if (uIncludeGrain == 1 && uGrainAmt > 0.0) {
      float pLum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
      float midFade = 4.0 * pLum * (1.0 - pLum);
      uint hVal = (uint(x) * 374761393u + uint(y) * 668265263u) ^ 0x5bf03635u;
      hVal = (hVal ^ (hVal >> 13u)) * 1274126177u;
      hVal = hVal ^ (hVal >> 16u);
      float noise = ((float(hVal) / 4294967295.0) - 0.5) * uGrainAmt * midFade;
      rgb += noise;
    }
  }

  outColor = vec4(clamp(rgb, 0.0, 1.0), src.a);
}
