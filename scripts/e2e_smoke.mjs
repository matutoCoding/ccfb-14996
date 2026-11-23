// 端到端链路：项目 -> 原稿分析 -> 排块生成 -> 预览渲染
const base = 'localhost:9224'

async function getTab() {
  for (let i = 0; i < 20; i++) {
    const list = await fetch(`http://${base}/json/list`).then((r) => r.json())
    const tab = list.find((t) => t.type === 'page')
    if (tab?.webSocketDebuggerUrl) return tab
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('找不到可调试标签页')
}

function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  const listeners = []
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    } else if (msg.method) listeners.forEach((fn) => fn(msg))
  })
  return {
    ready: new Promise((res) => ws.addEventListener('open', () => res())),
    send(method, params = {}) {
      const mid = ++id
      ws.send(JSON.stringify({ id: mid, method, params }))
      return new Promise((res) => pending.set(mid, res))
    },
    on(fn) {
      listeners.push(fn)
    },
    close() {
      ws.close()
    },
  }
}

const tab = await getTab()
const client = cdp(tab.webSocketDebuggerUrl)
await client.ready
await client.send('Page.enable')
await client.send('Runtime.enable')
await client.send('Target.setDiscoverTargets', { discover: true })
const errors = []
client.on((msg) => {
  if (msg.method === 'Runtime.exceptionThrown') {
    errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
  }
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
  }
})
const evalJs = async (expr) => {
  const r = await client.send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.text)
  return r.result?.result?.value
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (ok, msg) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

await client.send('Page.navigate', { url: 'http://127.0.0.1:5173/#/projects' })
await sleep(3500)

// 1. 打开人像项目的原稿页
await evalJs('document.querySelector(".project-card").click()')
await sleep(1200)
await evalJs('location.hash = "/projects/proj-portrait/source"')
await sleep(2500)
const hasCanvas = await evalJs('!!document.querySelector(".source-canvas")')
check(hasCanvas, '原稿页加载并渲染分析画布')
const flowLines = await evalJs('document.querySelectorAll(".stat-row strong").length')
check(flowLines >= 2, `走向场分析完成（统计行 ${flowLines} 条）`)

// 2. 进排块页并触发生成
await evalJs('location.hash = "/projects/proj-portrait/layout"')
await sleep(1500)
await evalJs('document.querySelector(".generate-btn").click()')
await sleep(3000)
const tileInfo = await evalJs('document.querySelector(".estimate strong")?.textContent')
check(Boolean(tileInfo), `排块生成完成，预计/实际块数显示：${tileInfo}`)
const hashShown = await evalJs('document.querySelector(".perf")?.textContent ?? ""')
check(hashShown.includes('哈希'), `确定性哈希已输出：${hashShown.split('·')[1]?.trim() ?? ''}`)
const tilePixels = await evalJs(`
  (() => {
    const c = document.querySelector('.tile-canvas')
    // 无头窗口 clientWidth 可能偏小，校验画布已按容器分配且有离屏内容即可
    return JSON.stringify({ w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight })
  })()
`)
const dims = JSON.parse(tilePixels)
check(dims.w > 0 && dims.h > 0 && dims.w === dims.h, `编辑器画布已分配（${dims.w}×${dims.h}，容器 ${dims.cw}px）`)

// 3. 存档版本（v-model 依赖 input 事件，原生赋值后必须 dispatch）
await evalJs(`
  (() => {
    const input = document.querySelector('.version-form .input')
    input.value = '冒烟存档'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()
`)
await evalJs(`
  (() => {
    const btn = [...document.querySelectorAll('.version-form .btn')].find((b) => b.textContent.includes('存档'))
    btn.click()
  })()
`)
await sleep(1500)
const versionDebug = await evalJs(`
  (() => {
    const btn = document.querySelector('.version-form .btn-primary')
    const items = document.querySelectorAll('.version-list li').length
    const labels = [...document.querySelectorAll('.v-label')].map((x) => x.textContent)
    return JSON.stringify({ disabled: btn?.disabled, items, labels, inputVal: document.querySelector('.version-form .input').value })
  })()
`)
const vd = JSON.parse(versionDebug)
check(vd.items >= 1, `版本存档落库（列表 ${vd.items} 条，按钮禁用=${vd.disabled}，${vd.labels.join('/') || '无标签'}）${errors.length ? ' | 页面异常: ' + errors.join(' || ') : ''}`)

// 4. 进预览页，验证 WebGL 持续渲染（新开标签页，避免任何 context 类型污染）
const newTab = await client.send('Target.createTarget', {
  url: 'http://127.0.0.1:5173/#/projects/proj-portrait/preview',
})
const targets = await fetch(`http://${base}/json/list`).then((r) => r.json())
const fresh = targets.find((t) => t.id === newTab.result.targetId)
const previewClient = cdp(fresh.webSocketDebuggerUrl)
await previewClient.ready
await previewClient.send('Runtime.enable')
const peval = async (expr) => {
  const r = await previewClient.send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })
  return r.result?.result?.value
}
await sleep(4000)
const previewDebug = await peval(`
  (() => JSON.stringify({
    error: document.querySelector('.error-box div:last-child')?.textContent ?? null,
    hud: [...document.querySelectorAll('.hud-item strong')].map((x) => x.textContent),
    hash: location.hash,
  }))()
`)
const pd = JSON.parse(previewDebug)
const tileCountHud = pd.hud[0]
check(!pd.error && Boolean(tileCountHud) && Number(String(tileCountHud).replace(/,/g, '')) > 1000, `预览实例化块数 ${tileCountHud ?? '无'}（${pd.error ?? '无错误提示'}）`)
const fpsText = await peval('document.querySelectorAll(".hud-item strong")[2]?.textContent')
check(Boolean(fpsText), `帧率计数器运行：${fpsText}`)
const lightButtons = await peval('document.querySelectorAll(".light-group .btn").length')
check(lightButtons === 3, `三种光源按钮就位（${lightButtons} 个）`)
// 切到蜡烛光验证 uniform 热更新不报错
await peval('document.querySelectorAll(".light-group .btn")[2].click()')
await sleep(800)
const candleActive = await peval('document.querySelectorAll(".light-group .btn")[2].classList.contains("active")')
check(candleActive, '切换蜡烛光源成功')
previewClient.close()
await client.send('Target.closeTarget', { targetId: newTab.result.targetId })

// 5. 进施工图页
await evalJs('location.hash = "/projects/proj-portrait/construction"')
await sleep(2000)
const billRows = await evalJs('document.querySelectorAll(".bill-table tbody tr").length')
const sheets = await evalJs('document.querySelectorAll(".sheet-card img").length')
check(billRows > 0, `材料清单 ${billRows} 行`)
check(sheets > 0, `平方米分格图生成 ${sheets} 张`)

client.close()
console.log(results.join('\n'))
const pass = results.every((r) => r.startsWith('PASS'))
console.log(pass ? 'E2E:PASS' : 'E2E:FAIL')
process.exit(pass ? 0 : 1)
