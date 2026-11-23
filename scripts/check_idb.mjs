// 直查 IndexedDB 真实数据
const base = 'localhost:9224'
const list = await fetch(`http://${base}/json/list`).then((r) => r.json())
const tab = list.find((t) => t.type === 'page' && t.url.includes('5173'))
const ws = new WebSocket(tab.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id) pending.get(msg.id)?.(msg)
})
await new Promise((r) => ws.addEventListener('open', r))
const evalJs = (expr) => {
  const mid = ++id
  ws.send(JSON.stringify({ id: mid, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } }))
  return new Promise((res) => pending.set(mid, (m) => res(m.result?.result?.value)))
}
const result = await evalJs(`
  new Promise((resolve) => {
    const req = indexedDB.open('mosaic-studio')
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction(['projects', 'versions'], 'readonly')
      const out = {}
      const pr = tx.objectStore('projects').getAll()
      pr.onsuccess = () => {
        out.projects = pr.result.map((p) => ({ id: p.id, currentVersionId: p.currentVersionId, name: p.name }))
        const vr = tx.objectStore('versions').getAll()
        vr.onsuccess = () => {
          out.versions = vr.result.map((v) => ({ id: v.id, label: v.label, count: v.tiles?.count, projectId: v.projectId }))
          resolve(JSON.stringify(out, null, 2))
        }
      }
    }
    req.onerror = () => resolve('OPEN_ERROR')
  })
`)
console.log(result)
ws.close()
process.exit(0)
