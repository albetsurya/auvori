#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uGradeTex;
uniform sampler2D uEffectsTex;
uniform ivec2 uSize;
uniform ivec2 uEffectsSize;
uniform int uIncludeGrain;

uniform float uBloomK;
uniform float uHalK;
uniform float uFadeLift;
uniform float uVigStrength;
uniform float uGrainAmt;

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

vec4 sampleEffects(vec2 uv) {
  vec2 fSize = vec2(uEffectsSize);
  vec2 aligned = (clamp(uv, 0.0, 1.0) * (fSize - 1.0) + 0.5) / fSize;
  return texture(uEffectsTex, aligned);
}

void main() {
  int x = int(gl_FragCoord.x);
  int y = int(gl_FragCoord.y);
  vec4 src = texelFetch(uGradeTex, ivec2(x, y), 0);
  vec3 rgb = src.rgb;

  vec2 normUv = vec2((float(x) + 0.5) / float(uSize.x), (float(y) + 0.5) / float(uSize.y));
  vec4 fx = sampleEffects(normUv);

  vec3 addGlow = fx.rgb * uBloomK + vec3(1.0, 0.28, 0.06) * (fx.a * uHalK);
  rgb = softHighlightRoll3(rgb + addGlow * (1.0 - 0.65 * rgb));

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

  outColor = vec4(clamp(rgb, 0.0, 1.0), src.a);
}
