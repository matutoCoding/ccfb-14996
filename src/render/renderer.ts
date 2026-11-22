// WebGL2 实例化渲染器：单次 draw call 绘制全部块（20 万块目标）
import type { Material, WallConfig } from '@/core/types'
import { readTile } from '@/core/types'
import type { LightPreset } from './light'
import { mat4Multiply, perspective, type OrbitCamera } from './orbit_camera'
import { rayIntersect, type Vec3 } from '@/core/wall'

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec4 iRect;       // x y w h（米）
layout(location=2) in float iAngle;
layout(location=3) in vec4 iColor;     // sRGB 0~1 + 金箔标记
layout(location=4) in vec3 iSurface;   // opacity / roughness / reflectivity
uniform vec2 uWall;
uniform int uKind;
uniform float uCurvature;
uniform mat4 uViewProj;
out vec3 vNormal;
out vec3 vWorldPos;
out vec4 vColor;
out vec3 vSurface;

float arcRadius(float W, float c) {
  if (c < 1e-6) return 99999.0;
  return (W * W) / (8.0 * c) + c * 0.5;
}

vec3 wallPoint(vec2 uv) {
  float W = uWall.x;
  float H = uWall.y;
  float y = uv.y * H - H * 0.5;
  if (uKind == 0) return vec3(uv.x * W - W * 0.5, y, 0.0);
  float R = arcRadius(W, uCurvature);
  float theta = W / R;
  float phi = theta * (uv.x - 0.5);
  if (uKind == 1) {
    return vec3(R * sin(phi), y, R * cos(phi) - R * cos(theta * 0.5));
  }
  float alpha = uv.y * 1.5707963;
  float rho = R * cos(alpha);
  return vec3(rho * sin(phi), R * sin(alpha) - R * 0.5,
    rho * cos(phi) - R * cos(theta * 0.5));
}

vec3 wallNormal(vec2 uv) {
  if (uKind == 0) return vec3(0.0, 0.0, 1.0);
  float R = arcRadius(uWall.x, uCurvature);
  float theta = uWall.x / R;
  float phi = theta * (uv.x - 0.5);
  if (uKind == 1) return vec3(sin(phi), 0.0, cos(phi));
  float alpha = uv.y * 1.5707963;
  return vec3(sin(phi) * cos(alpha), sin(alpha), cos(phi) * cos(alpha));
}

void main() {
  vec2 uv = iRect.xy / uWall;
  vec2 halfUv = (iRect.zw * 0.5) / uWall;
  vec2 corner = aCorner * halfUv;
  float c = cos(iAngle);
  float s = sin(iAngle);
  vec2 rot = vec2(corner.x * c - corner.y * s, corner.x * s + corner.y * c);
  vec2 tileUv = clamp(uv + rot, vec2(1e-5), vec2(1.0 - 1e-5));
  vec3 pos = wallPoint(tileUv);
  vec3 baseN = wallNormal(tileUv);
  float eps = 0.0008;
  vec3 tU = normalize(wallPoint(clamp(tileUv + vec2(eps, 0.0), vec2(0.0), vec2(1.0)))
    - wallPoint(clamp(tileUv - vec2(eps, 0.0), vec2(0.0), vec2(1.0))));
  vec3 tV = normalize(cross(baseN, tU));
  // 块倾斜角转化为微表面法线扰动
  vec3 n = normalize(baseN + (tU * sin(iAngle) + tV * (1.0 - cos(iAngle))) * 0.55);
  vNormal = n;
  vWorldPos = pos + n * 0.0025;
  vColor = iColor;
  vSurface = iSurface;
  gl_Position = uViewProj * vec4(vWorldPos, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPos;
in vec4 vColor;
in vec3 vSurface;
uniform vec3 uViewPos;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform float uAmbient;
uniform float uIntensity;
uniform float uBlowout;
uniform int uShowBlowout;
uniform float uTime;
out vec4 outColor;

float srgbToLinear(float x) {
  return x <= 0.04045 ? x / 12.92 : pow((x + 0.055) / 1.055, 2.4);
}

void main() {
  float isGold = vColor.a;
  vec3 baseColor = vec3(srgbToLinear(vColor.r), srgbToLinear(vColor.g), srgbToLinear(vColor.b));
  float opacity = vSurface.x;
  float roughness = vSurface.y;
  float reflectivity = vSurface.z;
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uViewPos - vWorldPos);
  vec3 L = normalize(-uLightDir);
  vec3 H = normalize(L + V);
  float ndl = max(dot(N, L), 0.0);
  float ndh = max(dot(N, H), 0.0);
  float shininess = mix(220.0, 12.0, roughness);
  float spec = pow(ndh, shininess);
  float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 diffuse = baseColor * (uAmbient * (0.6 + opacity * 0.4) + ndl * uIntensity * 0.8);
  vec3 specular = uLightColor * spec * fresnel * reflectivity * uIntensity;
  vec3 color = diffuse + specular;
  // 金箔：视角相关闪烁，相机移动时闪光跟着流动
  if (isGold > 0.5) {
    float cell = fract(sin(dot(floor(vWorldPos.xz * 90.0), vec2(12.9898, 78.233))) * 43758.5453);
    float twinkle = 0.5 + 0.5 * sin(uTime * 2.2 + cell * 40.0 + vWorldPos.x * 14.0);
    float glint = pow(ndh, 320.0) * (0.35 + 0.65 * twinkle) * 1.7;
    color += uLightColor * glint * reflectivity;
  }
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  if (uShowBlowout == 1 && lum > uBlowout) {
    color = mix(color, vec3(1.0, 0.16, 0.16), 0.82);
  }
  // ACES 近似 + gamma
  color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
  color = pow(color, vec3(1.0 / 2.2));
  outColor = vec4(color, opacity);
}
`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile error')
  }
  return shader
}

export interface RenderData {
  buffer: ArrayBuffer
  count: number
  materials: Material[]
  materialTable: Record<string, string>
}

// rect(4) + angle(1) + color(4) + surface(3) = 12 float，48 字节/实例
const INSTANCE_FLOATS = 12
const STRIDE = INSTANCE_FLOATS * 4

export class MosaicRenderer {
  private gl: WebGL2RenderingContext
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private quadBuffer: WebGLBuffer
  private instanceBuffer: WebGLBuffer
  private uniformLocs: Record<string, WebGLUniformLocation | null> = {}
  private instanceCount = 0
  private canvas: HTMLCanvasElement
  wall: WallConfig
  showBlowout = false
  private time = 0

  constructor(canvas: HTMLCanvasElement, wall: WallConfig) {
    this.canvas = canvas
    this.wall = wall
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false })
    if (!gl) throw new Error('当前浏览器不支持 WebGL2')
    this.gl = gl
    const vs = compile(gl, gl.VERTEX_SHADER, VERT)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG)
    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? 'program link error')
    }
    this.program = program
    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)
    this.quadBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    this.instanceBuffer = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, STRIDE, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, STRIDE, 16)
    gl.vertexAttribDivisor(2, 1)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, STRIDE, 20)
    gl.vertexAttribDivisor(3, 1)
    gl.enableVertexAttribArray(4)
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, STRIDE, 36)
    gl.vertexAttribDivisor(4, 1)
    gl.bindVertexArray(null)
    for (const name of [
      'uWall', 'uKind', 'uCurvature', 'uViewProj', 'uViewPos', 'uLightDir', 'uLightColor',
      'uAmbient', 'uIntensity', 'uBlowout', 'uShowBlowout', 'uTime',
    ]) {
      this.uniformLocs[name] = gl.getUniformLocation(program, name)
    }
    gl.clearColor(0.07, 0.08, 0.1, 1)
    gl.enable(gl.DEPTH_TEST)
  }

  // 块缓冲 + 材料表打包成实例属性
  setData(data: RenderData): void {
    const gl = this.gl
    const src = new DataView(data.buffer)
    const matById = new Map(data.materials.map((m) => [m.id, m]))
    const fallback: Material = {
      id: '__missing__',
      code: 'NA',
      name: '缺料',
      kind: 'stone',
      rgb: [200, 200, 195],
      opacity: 1,
      roughness: 0.8,
      reflectivity: 0.1,
      stock: 0,
    }
    const packed = new Float32Array(data.count * INSTANCE_FLOATS)
    for (let i = 0; i < data.count; i++) {
      const t = readTile(src, i)
      const mat = matById.get(data.materialTable[String(t.materialIndex)]) ?? fallback
      const o = i * INSTANCE_FLOATS
      packed[o] = t.x
      packed[o + 1] = t.y
      packed[o + 2] = t.w
      packed[o + 3] = t.h
      packed[o + 4] = t.angle
      packed[o + 5] = mat.rgb[0] / 255
      packed[o + 6] = mat.rgb[1] / 255
      packed[o + 7] = mat.rgb[2] / 255
      packed[o + 8] = mat.kind === 'gold' ? 1 : 0
      packed[o + 9] = mat.opacity
      packed[o + 10] = mat.roughness
      packed[o + 11] = mat.reflectivity
    }
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, packed.byteLength, gl.DYNAMIC_DRAW)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, packed)
    this.instanceCount = data.count
    gl.bindVertexArray(null)
  }

  render(cam: OrbitCamera, light: LightPreset, dt: number): void {
    const gl = this.gl
    this.time += dt
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.floor(this.canvas.clientWidth * dpr)
    const h = Math.floor(this.canvas.clientHeight * dpr)
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (this.instanceCount === 0) return
    const proj = perspective(Math.PI / 4, this.canvas.width / this.canvas.height, 0.05, 200)
    const viewProj = mat4Multiply(proj, cam.view)
    gl.useProgram(this.program)
    gl.uniform2f(this.uniformLocs.uWall, this.wall.width, this.wall.height)
    gl.uniform1i(this.uniformLocs.uKind, this.wall.kind === 'plane' ? 0 : this.wall.kind === 'curved' ? 1 : 2)
    gl.uniform1f(this.uniformLocs.uCurvature, this.wall.curvature)
    gl.uniformMatrix4fv(this.uniformLocs.uViewProj, false, viewProj)
    gl.uniform3fv(this.uniformLocs.uViewPos, cam.position)
    gl.uniform3fv(this.uniformLocs.uLightDir, light.lightDir)
    gl.uniform3fv(this.uniformLocs.uLightColor, light.lightColor)
    gl.uniform1f(this.uniformLocs.uAmbient, light.ambient)
    gl.uniform1f(this.uniformLocs.uIntensity, light.intensity)
    gl.uniform1f(this.uniformLocs.uBlowout, light.blowoutThreshold)
    gl.uniform1i(this.uniformLocs.uShowBlowout, this.showBlowout ? 1 : 0)
    gl.uniform1f(this.uniformLocs.uTime, this.time)
    gl.bindVertexArray(this.vao)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount)
    gl.bindVertexArray(null)
  }

  // 屏幕坐标拾取：反投影射线与墙面求交，返回布局 UV
  pick(clientX: number, clientY: number, cam: OrbitCamera): { u: number; v: number } | null {
    const rect = this.canvas.getBoundingClientRect()
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2
    const proj = perspective(Math.PI / 4, rect.width / rect.height, 0.05, 200)
    const inv = invertMat4(mat4Multiply(proj, cam.view))
    if (!inv) return null
    const near = transformPoint(inv, [ndcX, ndcY, -1])
    const far = transformPoint(inv, [ndcX, ndcY, 1])
    const dir: Vec3 = { x: far[0] - near[0], y: far[1] - near[1], z: far[2] - near[2] }
    const len = Math.hypot(dir.x, dir.y, dir.z) || 1
    return rayIntersect(this.wall, { x: near[0], y: near[1], z: near[2] }, {
      x: dir.x / len,
      y: dir.y / len,
      z: dir.z / len,
    })
  }

  dispose(): void {
    const gl = this.gl
    gl.deleteProgram(this.program)
    gl.deleteBuffer(this.quadBuffer)
    gl.deleteBuffer(this.instanceBuffer)
    gl.deleteVertexArray(this.vao)
  }
}

function invertMat4(m: Float32Array): Float32Array | null {
  const out = new Float32Array(16)
  const a = [...m]
  for (let i = 0; i < 4; i++) out[i * 4 + i] = 1
  for (let col = 0; col < 4; col++) {
    let pivot = col
    for (let row = col + 1; row < 4; row++) {
      if (Math.abs(a[row * 4 + col]) > Math.abs(a[pivot * 4 + col])) pivot = row
    }
    if (Math.abs(a[pivot * 4 + col]) < 1e-8) return null
    for (let j = 0; j < 4; j++) {
      const tmp = out[col * 4 + j]
      out[col * 4 + j] = out[pivot * 4 + j]
      out[pivot * 4 + j] = tmp
      const t2 = a[col * 4 + j]
      a[col * 4 + j] = a[pivot * 4 + j]
      a[pivot * 4 + j] = t2
    }
    const div = a[col * 4 + col]
    for (let j = 0; j < 4; j++) {
      out[col * 4 + j] /= div
      a[col * 4 + j] /= div
    }
    for (let row = 0; row < 4; row++) {
      if (row === col) continue
      const factor = a[row * 4 + col]
      for (let j = 0; j < 4; j++) {
        out[row * 4 + j] -= factor * out[col * 4 + j]
        a[row * 4 + j] -= factor * a[col * 4 + j]
      }
    }
  }
  return out
}

function transformPoint(m: Float32Array, p: [number, number, number]): [number, number, number] {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]
  return [x / w, y / w, z / w]
}
