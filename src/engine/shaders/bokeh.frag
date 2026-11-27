#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

// Mode 0 = splat weighted RGB + weight (0.5 scale to fit RGBA8 [0..1] safely without overflow)
// Mode 1 = horizontal separable box blur
// Mode 2 = vertical separable box blur (+ normalize if uNormalize > 0.5)
uniform int uMode;
uniform sampler2D uSourceTex;
uniform sampler2D uMaskTex;
uniform sampler2D uInputTex;
uniform ivec2 uSourceSize;
uniform ivec2 uMaskSize;
uniform ivec2 uBufSize;
uniform int uRadius;
uniform float uNormalize;

float clamp01(float v) {
  return clamp(v, 0.0, 1.0);
}

float samplePortraitMask(vec2 uv) {
  vec2 fSize = vec2(uMaskSize);
  vec2 aligned = (clamp(uv, 0.0, 1.0) * (fSize - 1.0) + 0.5) / fSize;
  return texture(uMaskTex, aligned).r;
}

void main() {
  if (uMode == 0) {
    int bx = int(gl_FragCoord.x);
    int by = int(gl_FragCoord.y);
    int sx = min(uSourceSize.x - 1, int(floor((float(bx) + 0.5) * (float(uSourceSize.x) / float(uBufSize.x)) + 0.5)));
    int sy = min(uSourceSize.y - 1, int(floor((float(by) + 0.5) * (float(uSourceSize.y) / float(uBufSize.y)) + 0.5)));

    vec3 rgb = texelFetch(uSourceTex, ivec2(sx, sy), 0).rgb;
    vec2 normCoord = vec2(float(sx) / float(uSourceSize.x), float(sy) / float(uSourceSize.y));
    float subj = samplePortraitMask(normCoord);
    float lum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
    float bloom = 1.0 + 0.55 * smoothstep(0.68, 0.96, lum);
    float wt = max(0.06, 1.0 - subj * 0.94) * bloom;

    // Multiply by 0.5 so max wt (~1.55) stays <= 0.775 inside standard RGBA8 buffers
    outColor = vec4(rgb * wt * 0.5, wt * 0.5);
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

  vec4 avg = acc / count;
  if (uNormalize > 0.5) {
    float inv = 1.0 / max(1e-4, avg.a);
    outColor = vec4(clamp(avg.rgb * inv, 0.0, 1.0), 1.0);
  } else {
    outColor = avg;
  }
}
