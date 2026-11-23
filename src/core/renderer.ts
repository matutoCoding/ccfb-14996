// WebGL2 实例化渲染器：单 draw call 渲染全部熔块
// 顶点着色器做 uv->3D 墙型映射，片元着色器做 PBR 简化光照 / 金箔闪烁 / 死白报警
import type { LayoutTiles, LightMode, Material, WallSpec } from './types'
import { TILE_STRIDE } from './types'
import { wallGlslFunc } from './geometry'

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;      // 单位四边形 -0.5..0.5
layout(location=1) in vec4 aInstance;    // cx, cy, w, h (uv)
layout(location=2) in vec2 aTiltPalette; // tilt, paletteIdx
uniform mat4 uViewProj;
uniform int uWallKind;
uniform float uWidth;
uniform float uHeight;
uniform float uRadius;
uniform float uArcAngle;
const float PI = 3.14159265359;
${wallGlslFunc()}
out vec3 vNormal;
out vec3 vWorld;
out vec2 vLocal;
flat out int vPaletteIdx;
flat out int vInstanceId;
void main() {
  float c = cos(aTiltPalette.x);
  float s = sin(aTiltPalette.x);
  vec2 local = aCorner * aInstance.zw;
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 uv = aInstance.xy + rotated;
  vec3 n;
  vec3 tanU;
  vec3 tanV;
  vec3 world;
  wallMap(uv, world, n, tanU, tanV);
  // 倾角法线扰动：沿解析切向按块内偏移量倾斜，幅度随倾斜角自然变化
  vec3 tileN = normalize(n + (tanU * rotated.x + tanV * rotated.y) * 2.4);
  vNormal = tileN;
  vWorld = world;
  vLocal = aCorner + 0.5;
  vPaletteIdx = int(aTiltPalette.y + 0.5);
  vInstanceId = gl_InstanceID;
  gl_Position = uViewProj * vec4(world, 1.0);
}
`

const FRAG = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorld;
in vec2 vLocal;
flat in int vPaletteIdx;
uniform sampler2D uPalette;   // 256x1: rgb 线性色, a=类别(0玻璃1金2石)
uniform sampler2D uMaterial;  // 256x1: r=opacity g=roughness b=reflectivity
uniform vec3 uEye;
uniform float uHeight;
uniform int uLightMode;       // 0 日光 1 射灯 2 蜡烛
uniform float uTime;
uniform float uIntensity;
uniform int uShowBurn;
out vec4 outColor;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  int pi = clamp(vPaletteIdx, 0, 255);
  vec4 tex = texelFetch(uPalette, ivec2(pi, 0), 0);
  vec4 mat = texelFetch(uMaterial, ivec2(pi, 0), 0);
  vec3 base = tex.rgb;
  float category = tex.a;
  float roughness = mat.g;
  float reflectivity = mat.b;

  vec3 N = normalize(vNormal);
  vec3 V = normalize(uEye - vWorld);

  // 光源：方向/位置/颜色随模式切换
  vec3 L;
  vec3 lightColor;
  float atten = 1.0;
  if (uLightMode == 0) {
    // 白天自然光：大角度漫射主光 + 天光
    L = normalize(vec3(0.45, 0.75, 0.55));
    lightColor = vec3(1.0, 0.97, 0.9) * 1.1;
  } else if (uLightMode == 1) {
    // 射灯：前方高位点光
    vec3 lp = vec3(0.0, uHeight * 0.95, 3.2);
    vec3 toLight = lp - vWorld;
    float dist = length(toLight);
    L = toLight / dist;
    atten = 6.0 / (1.0 + 0.25 * dist * dist);
    lightColor = vec3(1.0, 0.98, 0.95) * 1.6;
  } else {
    // 蜡烛：暖色低位点光，带轻微闪烁
    vec3 lp = vec3(sin(uTime * 0.7) * 0.15, uHeight * 0.12, 1.1);
    vec3 toLight = lp - vWorld;
    float dist = length(toLight);
    L = toLight / dist;
    atten = 3.2 / (1.0 + 0.9 * dist * dist);
    float flicker = 0.85 + 0.15 * sin(uTime * 9.0 + vWorld.y * 7.0);
    lightColor = vec3(1.0, 0.62, 0.28) * 1.5 * flicker;
  }

  float ndl = max(dot(N, L), 0.0);
  vec3 H = normalize(L + V);
  float specPow = mix(180.0, 8.0, roughness);
  float spec = pow(max(dot(N, H), 0.0), specPow) * reflectivity * atten;

  vec3 color;
  if (category > 0.5 && category < 1.5) {
    // 金箔：各向异性强高光 + 视角相关闪烁
    float blockSeed = hash11(float(pi) * 91.7 + floor(vWorld.x * 40.0) * 3.1 + floor(vWorld.y * 40.0) * 7.7);
    float glint = pow(max(dot(N, H), 0.0), mix(120.0, 400.0, blockSeed)) * (1.4 + blockSeed);
    float sweep = 0.5 + 0.5 * sin(uTime * 1.3 + blockSeed * 31.4 + vWorld.x * 3.0);
    color = base * (0.35 + 0.75 * ndl) * lightColor * atten;
    color += vec3(1.0, 0.78, 0.36) * (glint * 2.2 + spec * 1.5) * (0.6 + 0.4 * sweep);
  } else {
    float ambient = category > 1.5 ? 0.42 : 0.5; // 石头更吸光
    vec3 sky = vec3(0.55, 0.66, 0.82) * ambient;
    color = base * ((sky + lightColor * ndl * 0.9) * atten);
    color += lightColor * spec * (category > 1.5 ? 0.5 : 1.0);
    // 玻璃半透感：边缘加一点透射亮边
    if (category < 0.5) {
      float edge = smoothstep(0.42, 0.5, abs(vLocal.x - 0.5)) + smoothstep(0.42, 0.5, abs(vLocal.y - 0.5));
      color += base * edge * 0.12 * (1.0 - mat.r);
    }
  }
  color *= uIntensity;

  // 死白报警：过曝且低饱和区域
  float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float mx = max(color.r, max(color.g, color.b));
  float mn = min(color.r, min(color.g, color.b));
  float sat = mx > 0.001 ? (mx - mn) / mx : 0.0;
  if (uShowBurn == 1 && lum > 1.05 && sat < 0.18) {
    color = mix(color, vec3(1.0, 0.18, 0.1), 0.72);
  }
  outColor = vec4(color, 1.0);
}
`

const PICK_VERT = VERT
const PICK_FRAG = `#version 300 es
precision highp float;
flat in int vInstanceId;
uniform int uPickBase;
out vec4 outColor;
void main() {
  // 实例 ID 由顶点阶段经 flat varying 传入（片元阶段无 gl_InstanceID）
  int id = vInstanceId + uPickBase;
  outColor = vec4(float((id + 1) & 255) / 255.0,
                  float(((id + 1) >> 8) & 255) / 255.0,
                  float(((id + 1) >> 16) & 255) / 255.0, 1.0);
}
`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type)
  if (!sh) throw new Error('shader 创建失败')
  gl.shaderSource(sh, src)
  gl.compileShader(sh)
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error('shader 编译失败: ' + gl.getShaderInfoLog(sh))
  }
  return sh
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()
  if (!p) throw new Error('program 创建失败')
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('program 链接失败: ' + gl.getProgramInfoLog(p))
  }
  return p
}

export interface CameraState {
  yaw: number
  pitch: number
  distance: number
}

export class MosaicRenderer {
  private gl: WebGL2RenderingContext
  private mainProgram: WebGLProgram
  private pickProgram: WebGLProgram
  private vao: WebGLVertexArrayObject
  private cornerVbo: WebGLBuffer
  private instanceVbo: WebGLBuffer
  private paletteTex: WebGLTexture
  private materialTex: WebGLTexture
  private pickFbo: WebGLFramebuffer
  private pickTex: WebGLTexture
  private instanceCount = 0
  private wall: WallSpec
  private camera: CameraState = { yaw: 0, pitch: 0.08, distance: 5 }
  lightMode: LightMode = 'daylight'
  intensity = 1
  showBurn = false
  private time = 0
  private raf = 0
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private pickUniforms: Record<string, WebGLUniformLocation | null> = {}

  constructor(canvas: HTMLCanvasElement, wall: WallSpec) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false })
    if (!gl) throw new Error('当前浏览器不支持 WebGL2')
    this.gl = gl
    this.wall = wall
    this.mainProgram = program(gl, VERT, FRAG)
    this.pickProgram = program(gl, PICK_VERT, PICK_FRAG)
    this.vao = gl.createVertexArray()!
    this.cornerVbo = gl.createBuffer()!
    this.instanceVbo = gl.createBuffer()!
    this.paletteTex = gl.createTexture()!
    this.materialTex = gl.createTexture()!
    this.pickFbo = gl.createFramebuffer()!
    this.pickTex = gl.createTexture()!
    this.initBuffers()
    this.cacheUniforms()
    gl.enable(gl.DEPTH_TEST)
  }

  private cacheUniforms(): void {
    const gl = this.gl
    for (const p of [this.mainProgram, this.pickProgram]) {
      const target = p === this.mainProgram ? this.uniforms : this.pickUniforms
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i)
        if (info) target[info.name] = gl.getUniformLocation(p, info.name)
      }
    }
  }

  private initBuffers(): void {
    const gl = this.gl
    gl.bindVertexArray(this.vao)
    // 单位四边形
    gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerVbo)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    // 实例属性与同一个 VBO：location1 取前 4 float，location2 从偏移 16 字节取 2 float
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, TILE_STRIDE * 4, 0)
    gl.vertexAttribDivisor(1, 1)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, TILE_STRIDE * 4, 4 * 4)
    gl.vertexAttribDivisor(2, 1)
    gl.bindVertexArray(null)
  }

  // 上传排块：两个实例 buffer 共享同一 ArrayBuffer 的不同偏移
  uploadTiles(tiles: LayoutTiles): void {
    const gl = this.gl
    this.instanceCount = tiles.count
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo)
    gl.bufferData(gl.ARRAY_BUFFER, tiles.data.byteLength, gl.DYNAMIC_DRAW)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, tiles.data)
  }

  // 局部更新一块（手动编辑后只传 24 字节）
  updateTileRange(tiles: LayoutTiles, index: number, length = 1): void {
    const gl = this.gl
    const byteOffset = index * TILE_STRIDE * 4
    const view = new Float32Array(
      tiles.data.buffer,
      tiles.data.byteOffset + byteOffset,
      length * TILE_STRIDE,
    )
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVbo)
    gl.bufferSubData(gl.ARRAY_BUFFER, byteOffset, view)
  }

  uploadMaterials(tiles: LayoutTiles, materials: Material[]): void {
    const gl = this.gl
    const matMap = new Map(materials.map((m) => [m.id, m]))
    const colors = new Uint8Array(256 * 4)
    const params = new Uint8Array(256 * 4)
    const categoryCode = { glass: 0, gold: 1, stone: 2 }
    tiles.palette.forEach((entry, i) => {
      const m = matMap.get(entry.materialId)
      colors[i * 4] = entry.color[0]
      colors[i * 4 + 1] = entry.color[1]
      colors[i * 4 + 2] = entry.color[2]
      colors[i * 4 + 3] = m ? categoryCode[m.category] : 0
      if (m) {
        params[i * 4] = Math.round(m.opacity * 255)
        params[i * 4 + 1] = Math.round(m.roughness * 255)
        params[i * 4 + 2] = Math.round(m.reflectivity * 255)
      }
    })
    for (const [tex, data] of [
      [this.paletteTex, colors],
      [this.materialTex, params],
    ] as const) {
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    }
  }

  setCamera(patch: Partial<CameraState>): void {
    Object.assign(this.camera, patch)
  }

  getCamera(): CameraState {
    return { ...this.camera }
  }

  setWall(wall: WallSpec): void {
    this.wall = wall
  }

  resize(): void {
    const canvas = this.gl.canvas as HTMLCanvasElement
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr))
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr))
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
  }

  private viewProj(): Float32Array {
    const { yaw, pitch, distance } = this.camera
    const aspect = this.gl.canvas.width / Math.max(1, this.gl.canvas.height)
    const eye = [
      distance * Math.cos(pitch) * Math.sin(yaw),
      distance * Math.sin(pitch) + this.wall.height * 0.4,
      distance * Math.cos(pitch) * Math.cos(yaw),
    ]
    return mvp(eye, [0, this.wall.height * 0.4, 0], aspect)
  }

  private bindWallUniforms(u: Record<string, WebGLUniformLocation | null>): void {
    const gl = this.gl
    gl.uniform1i(u.uWallKind, { flat: 0, arc: 1, dome: 2 }[this.wall.kind])
    gl.uniform1f(u.uWidth, this.wall.width)
    gl.uniform1f(u.uHeight, this.wall.height)
    gl.uniform1f(u.uRadius, this.wall.radius)
    gl.uniform1f(u.uArcAngle, this.wall.arcAngle)
  }

  render(): void {
    const gl = this.gl
    this.resize()
    this.time += 0.016
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height)
    gl.clearColor(0.055, 0.06, 0.075, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    if (this.instanceCount === 0) return

    gl.useProgram(this.mainProgram)
    gl.bindVertexArray(this.vao)
    const u = this.uniforms
    gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj())
    this.bindWallUniforms(u)
    const { yaw, pitch, distance } = this.camera
    gl.uniform3f(
      u.uEye,
      distance * Math.cos(pitch) * Math.sin(yaw),
      distance * Math.sin(pitch) + this.wall.height * 0.4,
      distance * Math.cos(pitch) * Math.cos(yaw),
    )
    gl.uniform1i(u.uLightMode, { daylight: 0, spot: 1, candle: 2 }[this.lightMode])
    gl.uniform1f(u.uTime, this.time)
    gl.uniform1f(u.uIntensity, this.intensity)
    gl.uniform1i(u.uShowBurn, this.showBurn ? 1 : 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.paletteTex)
    gl.uniform1i(u.uPalette, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.materialTex)
    gl.uniform1i(u.uMaterial, 1)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount)
  }

  start(): void {
    const loop = () => {
      this.render()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
  }

  // 拾取：离屏 FBO 编码实例 ID，读单个像素
  pick(nx: number, ny: number): number {
    const gl = this.gl
    const w = gl.canvas.width
    const h = gl.canvas.height
    gl.bindTexture(gl.TEXTURE_2D, this.pickTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickTex, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return -1

    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.useProgram(this.pickProgram)
    gl.bindVertexArray(this.vao)
    const u = this.pickUniforms
    gl.uniformMatrix4fv(u.uViewProj, false, this.viewProj())
    this.bindWallUniforms(u)
    gl.uniform1i(u.uPickBase, 0)
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.instanceCount)

    const px = Math.floor(nx * w)
    const py = Math.floor((1 - ny) * h)
    const buf = new Uint8Array(4)
    gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    const id = buf[0] + buf[1] * 256 + buf[2] * 65536
    return id === 0 ? -1 : id - 1
  }

  dispose(): void {
    this.stop()
    const gl = this.gl
    gl.deleteBuffer(this.cornerVbo)
    gl.deleteBuffer(this.instanceVbo)
    gl.deleteTexture(this.paletteTex)
    gl.deleteTexture(this.materialTex)
    gl.deleteTexture(this.pickTex)
    gl.deleteFramebuffer(this.pickFbo)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.mainProgram)
    gl.deleteProgram(this.pickProgram)
  }
}

// 极简列主序矩阵：透视 * lookAt
function mvp(eye: number[], target: number[], aspect: number): Float32Array {
  const fov = (45 * Math.PI) / 180
  const f = 1 / Math.tan(fov / 2)
  const near = 0.1
  const far = 100
  const proj = new Float32Array(16)
  proj[0] = f / aspect
  proj[5] = f
  proj[10] = (far + near) / (near - far)
  proj[11] = -1
  proj[14] = (2 * far * near) / (near - far)

  const z = norm3([eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]])
  const x = norm3(cross3([0, 1, 0], z))
  const y = cross3(z, x)
  const view = new Float32Array(16)
  view[0] = x[0]; view[1] = y[0]; view[2] = z[0]; view[3] = 0
  view[4] = x[1]; view[5] = y[1]; view[6] = z[1]; view[7] = 0
  view[8] = x[2]; view[9] = y[2]; view[10] = z[2]; view[11] = 0
  view[12] = -dot3(x, eye); view[13] = -dot3(y, eye); view[14] = -dot3(z, eye); view[15] = 1
  return mul4(proj, view)
}

function norm3(v: number[]): number[] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
function cross3(a: number[], b: number[]): number[] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function dot3(a: number[], b: number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function mul4(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16)
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
    }
  }
  return out
}
