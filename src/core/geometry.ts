// 墙面参数化：uv(0-1) -> 三维位置与法线
// 三种墙型共用同一套 uv，排块只在 uv 平面生成，3D 交给 shader/这里的映射
import type { WallSpec } from './types'

export interface WallPoint {
  pos: [number, number, number]
  normal: [number, number, number]
}

// 返回 GLSL 函数字符串，供顶点着色器内联（保证与 CPU 版数学一致）
// 同时输出位置、法线与 uv 两个方向的解析切向量（顶点着色器不能用 dFdx/dFdy）
export function wallGlslFunc(): string {
  return `
void wallMap(vec2 uv, out vec3 pos, out vec3 normal, out vec3 tanU, out vec3 tanV) {
  float u = uv.x;
  float v = uv.y;
  if (uWallKind == 0) {
    pos = vec3((u - 0.5) * uWidth, v * uHeight, 0.0);
    normal = vec3(0.0, 0.0, 1.0);
    tanU = vec3(1.0, 0.0, 0.0);
    tanV = vec3(0.0, 1.0, 0.0);
  } else if (uWallKind == 1) {
    // 圆弧墙：绕 Y 轴，u 沿弧展开
    float theta = (u - 0.5) * uArcAngle;
    pos = vec3(uRadius * sin(theta), v * uHeight, uRadius * (cos(theta) - 1.0));
    normal = vec3(sin(theta), 0.0, cos(theta));
    tanU = vec3(cos(theta), 0.0, -sin(theta));
    tanV = vec3(0.0, 1.0, 0.0);
  } else {
    // 半穹顶：球坐标，u=方位角，v=极角(从拱顶到拱脚)
    float phi = (u - 0.5) * uArcAngle;       // 方位
    float theta = mix(0.02, PI * 0.5, v);    // 极角
    float st = sin(theta);
    float ct = cos(theta);
    pos = vec3(
      uRadius * st * sin(phi),
      uRadius * ct,
      uRadius * st * cos(phi) - uRadius
    );
    normal = normalize(vec3(st * sin(phi), ct, st * cos(phi)));
    tanU = normalize(vec3(st * cos(phi), 0.0, -st * sin(phi)));
    tanV = normalize(vec3(ct * sin(phi), -st, ct * cos(phi)));
  }
}
`
}

export function wallPoint(wall: WallSpec, u: number, v: number): WallPoint {
  switch (wall.kind) {
    case 'flat': {
      return {
        pos: [(u - 0.5) * wall.width, v * wall.height, 0],
        normal: [0, 0, 1],
      }
    }
    case 'arc': {
      const theta = (u - 0.5) * wall.arcAngle
      return {
        pos: [
          wall.radius * Math.sin(theta),
          v * wall.height,
          wall.radius * (Math.cos(theta) - 1),
        ],
        normal: [Math.sin(theta), 0, Math.cos(theta)],
      }
    }
    case 'dome': {
      const phi = (u - 0.5) * wall.arcAngle
      const theta = 0.02 + v * (Math.PI * 0.5 - 0.02)
      const st = Math.sin(theta)
      return {
        pos: [
          wall.radius * st * Math.sin(phi),
          wall.radius * Math.cos(theta),
          wall.radius * st * Math.cos(phi) - wall.radius,
        ],
        normal: normalize3([st * Math.sin(phi), Math.cos(theta), st * Math.cos(phi)]),
      }
    }
  }
}

function normalize3(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}

// 墙面实际面积（平方米），用于施工图分格与材料清单
export function wallArea(wall: WallSpec): number {
  switch (wall.kind) {
    case 'flat':
      return wall.width * wall.height
    case 'arc':
      return wall.radius * wall.arcAngle * wall.height
    case 'dome': {
      // 半球冠侧面积 2πR² 按 arcAngle/2π 与极角范围折算
      const t0 = 0.02
      const t1 = Math.PI * 0.5
      const frac = wall.arcAngle / (2 * Math.PI)
      return 2 * wall.radius * wall.radius * (Math.cos(t0) - Math.cos(t1)) * frac
    }
  }
}

// uv 平面上 1 单位 u/v 对应的物理尺寸（米），排块把米换算成 uv 用
export function uvScale(wall: WallSpec): { su: number; sv: number } {
  switch (wall.kind) {
    case 'flat':
      return { su: wall.width, sv: wall.height }
    case 'arc':
      return { su: wall.radius * wall.arcAngle, sv: wall.height }
    case 'dome':
      return { su: wall.radius * wall.arcAngle, sv: wall.radius * (Math.PI * 0.5 - 0.02) }
  }
}
