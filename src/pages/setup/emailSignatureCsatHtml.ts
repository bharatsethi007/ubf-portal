import { toast } from 'sonner'

export const EMAIL_SIGNATURE_CSAT_BASE = 'https://REPLACE-WITH-PORTAL-DOMAIN'

const EMOJIS = ['😞', '😐', '🙂', '😀', '🤩'] as const

export function buildEmailSignatureHtml(
  initials: string,
  base: string = EMAIL_SIGNATURE_CSAT_BASE,
): string {
  const rep = encodeURIComponent(initials)
  const links = EMOJIS.map((emoji, i) => {
    const href = `${base}/rate?rep=${rep}&score=${i + 1}&c=email_signature`
    return `<a href="${href}" target="_blank" style="text-decoration:none;font-size:18px;margin:0 2px;">${emoji}</a>`
  }).join('')
  return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#0A2472;">
    <tr><td style="padding-top:6px;">
      <span style="color:#555;">How did we do? </span>${links}
    </td></tr></table>`
}

export async function copyEmailSignature(sig: string): Promise<void> {
  const plain = 'How did we do? (rate 1-5 via the links in the HTML version)'
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([sig], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ])
    toast.success('Signature copied — paste into Outlook → Settings → Mail → Compose and reply')
  } catch {
    const el = document.getElementById('sig-preview')
    if (el) {
      const r = document.createRange()
      r.selectNodeContents(el)
      const s = window.getSelection()
      s?.removeAllRanges()
      s?.addRange(r)
      document.execCommand('copy')
      s?.removeAllRanges()
      toast.success('Signature copied')
    } else {
      toast.error('Copy failed — use Copy HTML instead')
    }
  }
}

export async function copyEmailSignatureHtml(sig: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(sig)
    toast.success('Signature HTML copied')
  } catch {
    toast.error('Could not copy — select the HTML source and copy manually')
  }
}

export function downloadEmailSignature(sig: string, initials: string): void {
  const blob = new Blob([sig], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `UBF-CSAT-signature-${initials}.htm`
  a.click()
  URL.revokeObjectURL(url)
}
