#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

// Mode 0 = splat Bloom (rgb) + Halation (a) emission above thresholds
// Mode 1 = horizontal separable box blur
// Mode 2 = vertical separable box blur
uniform int uMode;
uniform sampler2D uSourceTex;
uniform sampler2D uInputTex;
uniform ivec2 uSourceSize;
uniform ivec2 uBufSize;
uniform int uRadius;
uniform int uStep;
uniform float uBloomStrength;
uniform float uBloomThreshold;
uniform float uHalationStrength;
uniform float uHalationThreshold;

float lumAt(int px, int py) {
  int cx = clamp(px, 0, uSourceSize.x - 1);
  int cy = clamp(py, 0, uSourceSize.y - 1);
  vec3 c = texelFetch(uSourceTex, ivec2(cx, cy), 0).rgb;
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

void main() {
  if (uMode == 0) {
    int ex = int(gl_FragCoord.x);
    int ey = int(gl_FragCoord.y);
    int sx = min(uSourceSize.x - 1, int(floor((float(ex) + 0.5) * (float(uSourceSize.x) / float(uBufSize.x)) + 0.5)));
    int sy = min(uSourceSize.y - 1, int(floor((float(ey) + 0.5) * (float(uSourceSize.y) / float(uBufSize.y)) + 0.5)));

    vec3 rgb = texelFetch(uSourceTex, ivec2(sx, sy), 0).rgb;
    float lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;

    vec3 bloom = vec3(0.0);
    if (uBloomStrength > 0.1 && lum > uBloomThreshold) {
      float bloomHi = min(0.99, uBloomThreshold + 0.22);
      float bEmit = smoothstep(uBloomThreshold, bloomHi, lum);
      bloom = rgb * bEmit;
    }

    float hal = 0.0;
    if (uHalationStrength > 0.1 && lum > uHalationThreshold) {
      float halHi = min(0.99, uHalationThreshold + 0.18);
      float avgN = 0.25 * (
        lumAt(sx - uStep, sy) +
        lumAt(sx + uStep, sy) +
        lumAt(sx, sy - uStep) +
        lumAt(sx, sy + uStep)
      );
      float edgeContrast = max(0.0, lum - avgN);
      hal = smoothstep(uHalationThreshold, halHi, lum) * (0.55 + 0.45 * smoothstep(0.015, 0.16, edgeContrast));
    }

    outColor = vec4(clamp(bloom, 0.0, 1.0), clamp(hal, 0.0, 1.0));
    return;
  }

  int x = int(gl_FragCoord.x);
  int y = int(gl_FragCoord.y);
  int r = max(1, uRadius);
  vec4 acc = vec4(0.0);
  float count = float(r * 2 + 1);

  if (uMode == 1) {
    for (int k = -48; k <= 48; k++) {
      if (k < -r || k > r) continue;
      int cx = clamp(x + k, 0, uBufSize.x - 1);
      acc += texelFetch(uInputTex, ivec2(cx, y), 0);
    }
  } else {
    for (int k = -48; k <= 48; k++) {
      if (k < -r || k > r) continue;
      int cy = clamp(y + k, 0, uBufSize.y - 1);
      acc += texelFetch(uInputTex, ivec2(x, cy), 0);
    }
  }

  outColor = clamp(acc / count, 0.0, 1.0);
}
