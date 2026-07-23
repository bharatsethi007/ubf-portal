import { JSDOM } from 'jsdom'
import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  Node: dom.window.Node,
})

function useBookingContainers(bookingId, initial) {
  const [rows, setRows] = useState(initial)
  const [side, setSide] = useState(false)
  useEffect(() => {
    setRows(initial)
  }, [bookingId, initial])
  useEffect(() => {
    const t = setTimeout(() => setSide(true), 0)
    return () => clearTimeout(t)
  }, [bookingId])
  return rows
}

let renderCount = 0
const errors = []
console.error = (...args) => errors.push(args.map(String).join(' '))

function App() {
  renderCount += 1
  const bundle = null
  useBookingContainers('id', bundle?.containers ?? [])
  return React.createElement('div', null, String(renderCount))
}

createRoot(document.getElementById('root')).render(React.createElement(App))

await new Promise((r) => setTimeout(r, 500))
console.log(JSON.stringify({
  renderCount,
  depthErrors: errors.filter((e) => /maximum update depth|too many re-renders/i.test(e)),
}, null, 2))
