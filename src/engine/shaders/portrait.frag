#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSourceTex;
uniform sampler2D uMaskTex;
uniform ivec2 uSize;
uniform ivec2 uMaskSize;
uniform int uHasMask;
uniform int uSkinStep;
uniform float uSkinSmoothStrength;
uniform float uSharpenAmt;

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

float samplePortraitMask(vec2 uv) {
  vec2 fSize = vec2(uMaskSize);
  vec2 aligned = (clamp(uv, 0.0, 1.0) * (fSize - 1.0) + 0.5) / fSize;
  return texture(uMaskTex, aligned).r;
}

float lumAt(int nx, int ny) {
  int cx = clamp(nx, 0, uSize.x - 1);
  int cy = clamp(ny, 0, uSize.y - 1);
  vec3 c = texelFetch(uSourceTex, ivec2(cx, cy), 0).rgb;
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

void main() {
  int x = int(gl_FragCoord.x);
  int y = int(gl_FragCoord.y);
  vec4 src = texelFetch(uSourceTex, ivec2(x, y), 0);
  vec3 rgb = src.rgb;

  float invW = 1.0 / float(uSize.x);
  float invH = 1.0 / float(uSize.y);
  float nxNorm = (float(x) + 0.5) * invW;
  float nyNorm = (float(y) + 0.5) * invH;
  float depthFade = 1.0 - 0.78 * smoothstep(0.68, 0.94, nyNorm);

  float subj = 1.0;
  float effBgMask = 0.0;
  if (uHasMask == 1) {
    subj = samplePortraitMask(vec2(nxNorm, nyNorm));
    effBgMask = (1.0 - subj) * depthFade;
  }

  float rawLum = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  float rawSkinW = computeSkinWeight(rgb);
  float smoothApplied = 0.0;

  if (uSkinSmoothStrength > 0.015 && rawSkinW > 0.04) {
    float r0 = rgb.r;
    float g0 = rgb.g;
    float b0 = rgb.b;
    float lum0 = rawLum;
    float rangeInv = 10.0;

    float lL = lumAt(x - uSkinStep, y);
    float lR = lumAt(x + uSkinStep, y);
    float lU = lumAt(x, y - uSkinStep);
    float lD = lumAt(x, y + uSkinStep);
    float edgeMag = abs(lL - lR) + abs(lU - lD);

    vec3 sumRgb = rgb;
    float sumW = 1.0;

    int s1 = uSkinStep;
    int s2 = uSkinStep * 2;
    ivec2 offsets[12] = ivec2[12](
      ivec2(-s1, 0), ivec2(s1, 0), ivec2(0, -s1), ivec2(0, s1),
      ivec2(-s1, -s1), ivec2(s1, -s1), ivec2(-s1, s1), ivec2(s1, s1),
      ivec2(-s2, 0), ivec2(s2, 0), ivec2(0, -s2), ivec2(0, s2)
    );

    for (int i = 0; i < 12; i++) {
      int ox = x + offsets[i].x;
      int oy = y + offsets[i].y;
      if (ox < 0 || ox >= uSize.x || oy < 0 || oy >= uSize.y) continue;
      vec3 nc = texelFetch(uSourceTex, ivec2(ox, oy), 0).rgb;
      float nLum = 0.299 * nc.r + 0.587 * nc.g + 0.114 * nc.b;
      float diff = abs(nLum - lum0) + abs(nc.r - r0) * 0.45;
      float wt = max(0.0, 1.0 - diff * rangeInv);
      float wtSq = wt * wt;
      if (wtSq > 0.0) {
        sumRgb += nc * wtSq;
        sumW += wtSq;
      }
    }

    vec3 smoothRgb = sumRgb / sumW;
    float edgeKeep = 1.0 - smoothstep(0.06, 0.16, edgeMag);
    smoothApplied = rawSkinW * uSkinSmoothStrength * edgeKeep;
    rgb += (smoothRgb - rgb) * smoothApplied;
  }

  if (uSharpenAmt > 0.015 && effBgMask < 0.45) {
    float avgL = (
      lumAt(x - uSkinStep, y) +
      lumAt(x + uSkinStep, y) +
      lumAt(x, y - uSkinStep) +
      lumAt(x, y + uSkinStep)
    ) * 0.25;
    float rawDetail = rawLum - avgL;
    float clampedDetail = clamp(rawDetail, -0.055, 0.055);
    float fgSharpW = (1.0 - effBgMask * 2.2) * (1.0 - smoothApplied * 1.4);
    if (fgSharpW > 0.0) {
      float dAdd = clampedDetail * uSharpenAmt * 0.72 * fgSharpW;
      rgb = clamp(rgb + dAdd, 0.0, 1.0);
    }
  }

  outColor = vec4(clamp(rgb, 0.0, 1.0), src.a);
}
