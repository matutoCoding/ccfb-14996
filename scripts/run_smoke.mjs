// 用 pnpm 实际安装位置的 esbuild 打包并运行核心冒烟测试
import { execFileSync } from 'node:child_process'
import { globSync, mkdirSync } from 'node:fs'

const candidates = globSync('node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild')
if (candidates.length === 0) {
  console.error('未找到 esbuild，请先执行 pnpm install')
  process.exit(1)
}
mkdirSync('node_modules/.cache', { recursive: true })
execFileSync(process.execPath, [
  candidates[0],
  'scripts/smoke_test.ts',
  '--bundle',
  '--platform=node',
  '--format=esm',
  '--alias:@=./src',
  '--outfile=node_modules/.cache/smoke.mjs',
], { stdio: 'inherit' })
execFileSync(process.execPath, ['node_modules/.cache/smoke.mjs'], { stdio: 'inherit' })
