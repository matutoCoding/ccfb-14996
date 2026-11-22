// 轨道相机：球面坐标围绕墙面中心，支持拖拽旋转、滚轮缩放、自动旋转
export interface CameraState {
  yaw: number
  pitch: number
  distance: number
  target: [number, number, number]
  autoRotate: boolean
}

export interface OrbitCamera {
  state: CameraState
  view: Float32Array
  position: [number, number, number]
  update: () => void
  rotate: (dx: number, dy: number) => void
  zoom: (delta: number) => void
}

function mat4LookAt(eye: [number, number, number], target: [number, number, number], up: [number, number, number]): Float32Array {
  const zx = eye[0] - target[0]
  const zy = eye[1] - target[1]
  const zz = eye[2] - target[2]
  let len = Math.hypot(zx, zy, zz) || 1
  const z0 = zx / len
  const z1 = zy / len
  const z2 = zz / len
  let xx = up[1] * z2 - up[2] * z1
  let xy = up[2] * z0 - up[0] * z2
  let xz = up[0] * z1 - up[1] * z0
  len = Math.hypot(xx, xy, xz) || 1
  xx /= len
  xy /= len
  xz /= len
  const yx = z1 * xz - z2 * xy
  const yy = z2 * xx - z0 * xz
  const yz = z0 * xy - z1 * xx
  return new Float32Array([
    xx, yx, z0, 0,
    xy, yy, z1, 0,
    xz, yz, z2, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]),
    1,
  ])
}

export function createOrbitCamera(initialDistance: number): OrbitCamera {
  const cam: OrbitCamera = {
    state: {
      yaw: 0,
      pitch: 0.12,
      distance: initialDistance,
      target: [0, 0, 0],
      autoRotate: false,
    },
    view: new Float32Array(16),
    position: [0, 0, initialDistance],
    update() {
      const { yaw, pitch, distance, target } = this.state
      const cp = Math.cos(pitch)
      this.position = [
        target[0] + distance * Math.sin(yaw) * cp,
        target[1] + distance * Math.sin(pitch),
        target[2] + distance * Math.cos(yaw) * cp,
      ]
      this.view = mat4LookAt(this.position, target, [0, 1, 0])
    },
    rotate(dx, dy) {
      this.state.yaw -= dx * 0.006
      this.state.pitch = Math.max(-1.2, Math.min(1.2, this.state.pitch + dy * 0.006))
      this.update()
    },
    zoom(delta) {
      this.state.distance = Math.max(0.4, Math.min(60, this.state.distance * (1 + delta * 0.0012)))
      this.update()
    },
  }
  cam.update()
  return cam
}

export function perspective(fovY: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1 / Math.tan(fovY / 2)
  const nf = 1 / (near - far)
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0,
  ])
}

export function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16)
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i * 4 + j] =
        a[j] * b[i * 4] + a[4 + j] * b[i * 4 + 1] + a[8 + j] * b[i * 4 + 2] + a[12 + j] * b[i * 4 + 3]
    }
  }
  return out
}
