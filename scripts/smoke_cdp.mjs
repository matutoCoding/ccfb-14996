// 原生 CDP 驱动：打开冒烟页 -> 等待结果 -> 抓取 pre 文本
const base = 'http://127.0.0.1:9222'

async function getTab() {
  for (let i = 0; i < 20; i++) {
    const list = await fetch(`${base}/json/list`).then((r) => r.json())
    const tab = list.find((t) => t.type === 'page')
    if (tab?.webSocketDebuggerUrl) return tab
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error('找不到可调试标签页')
}

// 极简 WebSocket 帧封装（Node 24 内置 WebSocket）
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
await client.send('Page.navigate', { url: 'http://127.0.0.1:5173/smoke.html' })

// 轮询页面 title，最多等 25 秒
const deadline = Date.now() + 25000
let result = ''
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 1000))
  const evalRes = await client.send('Runtime.evaluate', {
    expression: 'document.title + "|||" + document.getElementById("out")?.innerText',
    returnByValue: true,
  })
  result = evalRes.result?.result?.value ?? ''
  if (result.startsWith('SMOKE_RESULT:')) break
}
client.close()
console.log(result || 'TIMEOUT: 未拿到结果')
process.exit(result.startsWith('SMOKE_RESULT:PASS') ? 0 : 1)
