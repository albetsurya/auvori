#version 300 es
precision highp float;

layout(location = 0) in vec2 aPosition;
out vec2 vUv;

uniform float uFlipY;

void main() {
  vec2 uv = aPosition * 0.5 + 0.5;
  vUv = uFlipY > 0.5 ? vec2(uv.x, 1.0 - uv.y) : uv;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
