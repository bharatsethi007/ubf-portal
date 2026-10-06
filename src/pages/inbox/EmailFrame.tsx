// Renders an email's Outlook HTML in a sandboxed frame (no scripts) that grows to fit its content.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../supabase'

type Part = { html: string; has_history?: boolean }
const cache = new Map<string, Promise<Part>>()

export function fetchEmailHtml(messageId: number, full = false): Promise<Part> {
  const key = `${messageId}:${full ? 'f' : 'u'}`
  let p = cache.get(key)
  if (!p) {
    p = supabase.functions.invoke('email-html', { body: { message_id: messageId, part: full ? 'full' : undefined } })
      .then(({ data, error }) => {
        if (error || !data?.html) throw new Error(error?.message ?? data?.error ?? 'no html')
        return data as Part
      })
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

const CSP = "default-src 'none'; img-src data: https: http:; style-src 'unsafe-inline' https:; font-src https: data:"
const BASE = `html,body{margin:0;padding:0;background:#fff}
body{font-family:'Segoe UI',Aptos,system-ui,sans-serif;font-size:14.5px;line-height:1.45;color:#242424;overflow-wrap:anywhere;overflow-x:auto}
img{max-width:100%;height:auto}a{color:#0F6CBD}p{margin:0 0 .5em}blockquote{margin:0 0 0 .8em;padding-left:.8em;border-left:2px solid #E1DFDD}`

function wrap(html: string): string {
  const styles = (html.match(/<style[\s\S]*?<\/style>/gi) ?? []).join('')
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">`
    + `<base target="_blank"><style>${BASE}</style>${styles}</head><body>${body}</body></html>`
}

export default function EmailFrame({ html }: { html: string }) {
  const ref = useRef<HTMLIFrameElement>(null)
  const [h, setH] = useState(40)

  useEffect(() => {
    const f = ref.current
    if (!f) return
    let ro: ResizeObserver | null = null
    const fit = () => { const d = f.contentDocument; if (d?.body) setH(Math.max(d.documentElement.scrollHeight, d.body.scrollHeight) + 2) }
    const onLoad = () => {
      fit()
      const d = f.contentDocument
      if (d?.body) { ro = new ResizeObserver(fit); ro.observe(d.body) }
      d?.querySelectorAll('img').forEach((img) => img.addEventListener('load', fit))
    }
    f.addEventListener('load', onLoad)
    return () => { f.removeEventListener('load', onLoad); ro?.disconnect() }
  }, [html])

  return (
    <iframe ref={ref} title="Email" className="ibx-mail__frame" style={{ height: h }} srcDoc={wrap(html)}
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" />
  )
}
