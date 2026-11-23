# 熔光工坊 · 马赛克壁画排块与光照预览系统

浏览器内的马赛克壁画工作室工具：原稿走向分析、确定性排块、材料库存管理、WebGL2 实时光照预览、施工图出图。数据全部存 IndexedDB，无后端。

## 启动

```bash
pnpm install
pnpm dev        # 开发
pnpm build      # 类型检查 + 生产构建
pnpm test       # 核心算法单测（12 项）
```

首次打开会自动写入三套测试工程（人像平面墙 / 几何弧墙 / 半穹顶）与 16 种材料（10 玻璃 + 3 金箔 + 3 石材）。

## 六大页面

| 路由 | 页面 | 能力 |
| --- | --- | --- |
| `/projects` | 项目列表 | 按墙面管工程，墙型（平面/圆弧/半穹顶）、尺寸、曲率半径、弧度、朝向 |
| `/projects/:id/source` | 原稿处理 | 导入图片，Sobel + 结构张量提取走向场，流线可视化引导线 |
| `/projects/:id/layout` | 排块编辑 | 参数化生成、单块拖动/改色/改倾角、匹配警告、版本快照、复现性自检 |
| `/materials` | 材料库 | 玻璃/金箔/石头分类，颜色、透明度、表面起伏、反光参数与库存 |
| `/projects/:id/preview` | 墙面预览 | WebGL2 实例化渲染，日光/射灯/蜡烛，金箔闪烁，死白区域报警 |
| `/projects/:id/construction` | 施工图 | 每平方米分格出图、颜色编号、打印/PDF、按色汇总材料清单 |

## 三个硬指标如何保证

### 1. 二十万块流畅

- 排块紧凑存储：每块 6 个 float / 24 字节，20 万块 ≈ 4.8MB（`core/types.ts` TILE_STRIDE）
- WebGL2 实例化渲染，全部熔块单次 draw call，实例属性走同一个 VBO 的双偏移（`core/renderer.ts`）
- 墙的曲率全部在顶点着色器内做 uv→3D 映射，换墙型不重新排块
- 2D 编辑器用离屏画布缓存，拖动时只 blit + 重绘选中块，不逐帧重绘几万块
- 拾取用离屏 FBO 编码实例 ID 读像素，不做 CPU 遍历

### 2. 同参数结果一致

- 全链路禁用 `Math.random()`，统一走 `mulberry32` 种子随机数（`core/rng.ts`）
- 排块输出带 FNV-1a 哈希，界面上有「复现性自检」按钮，单测锁定逐字节一致

### 3. Lab 色差

- sRGB → XYZ(D65) → Lab 标准转换，色差用 CIEDE2000（`core/color.ts`），不用 RGB 欧氏距离
- 目标色 Lab 做缓存避免重复转换；库存不足、ΔE 过大、用色超限时在排块页出警告

## 目录结构

```
src/core/
  rng.ts          确定性随机数 + 哈希
  color.ts        Lab 转换 + CIEDE2000
  geometry.ts     三种墙型 uv→3D 映射（CPU + GLSL 双实现）
  image.ts        结构张量走向场 + 引导流线 + 面积取色
  layout.ts       排块生成器 + 单块读写 + 深拷贝
  renderer.ts     WebGL2 实例化渲染器（光照/金箔/死白/拾取）
  construction.ts 分格施工图 + 材料清单 + 打印
  db.ts           IndexedDB 仓储（写入前解 Vue 响应式代理）
  seed.ts         程序化测试原稿与材料
src/pages/        六个页面
src/store/        跨页面会话态
tests/            vitest 单测
scripts/          CDP 无头浏览器冒烟脚本
public/smoke.html WebGL 渲染管线冒烟页
```

## 无头浏览器冒烟（可选）

需要本机有 Edge/Chromium，以带远程调试端口的无头模式启动后：

```bash
node scripts/smoke_cdp.mjs    # shader 编译、实例化、三光源、拾取、穹顶映射
node scripts/app_smoke.mjs    # 应用挂载、IDB 种子、路由
node scripts/e2e_smoke.mjs    # 原稿→排块→存档→预览→施工图全链路
```

## 已知边界

- 排块生成是 CPU 单线程，20 万块全量 Lab 匹配约 2~4 秒（一次性成本，预览是 GPU 实时）
- 施工图按 uv 分格，穹顶的物理分格是近似等距，非严格测地网格
- 金箔闪烁用高光功率 + 扫光近似，未做各向异性 BRDF 实测建模
