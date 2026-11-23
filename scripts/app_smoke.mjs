// 应用级冒烟：验证 Vue 挂载、IndexedDB 种子、路由页面可渲染
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
const logs = []
client.on((msg) => {
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    logs.push(msg.params.args.map((a) => a.value ?? a.description).join(' '))
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push(msg.params.exceptionDetails.exception?.description ?? 'exception')
  }
})
await client.send('Page.navigate', { url: 'http://127.0.0.1:5173/#/projects' })
await new Promise((r) => setTimeout(r, 4000))

const evalJs = async (expr) => {
  const r = await client.send('Runtime.evaluate', {
    expression: expr,
    returnByValue: true,
    awaitPromise: true,
  })
  return r.result?.result?.value
}

const results = []
const check = (ok, msg) => results.push(`${ok ? 'PASS' : 'FAIL'}  ${msg}`)

check((await evalJs('document.querySelectorAll(".project-card").length')) === 3, '种子写入 3 个测试项目')
check((await evalJs('document.querySelector(".title")?.textContent')) === '项目列表', '项目列表页挂载')
check((await evalJs('indexedDB.databases().then(d => d.map(x => x.name))')).includes('mosaic-studio'), 'IndexedDB 已创建')

// 路由跳转到材料库
await evalJs('location.hash = "/materials"')
await new Promise((r) => setTimeout(r, 1500))
const matCount = await evalJs('document.querySelectorAll(".material-card").length')
check(matCount === 16, `材料库渲染 ${matCount} 条种子材料`)

check(logs.length === 0, `控制台无报错（${logs.length} 条）${logs.length ? '：' + logs.join(' | ') : ''}`)
client.close()
console.log(results.join('\n'))
const pass = results.every((r) => r.startsWith('PASS'))
console.log(pass ? 'APP_SMOKE:PASS' : 'APP_SMOKE:FAIL')
process.exit(pass ? 0 : 1)
