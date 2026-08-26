import QRCode from 'qrcode'
import type { TmsConsignmentDetail } from './tmsApi'

export async function qr(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 1, width: 220 })
}

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))

function goodsBadge(goods: string): string {
  if (goods === 'dangerous') return `<span style="display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border:2px solid #c0392b;border-radius:8px;color:#c0392b;font-weight:800;font-size:16px">DG</span>`
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border:2px solid #111;border-radius:8px;color:#111;font-weight:800;font-size:24px">G</span>`
}

export function buildNoteHtml(d: TmsConsignmentDetail, qrUrl: string): string {
  const date = new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const dg = d.goods_type === 'dangerous'
  const rows = (d.cargo ?? []).map((l) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.units ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.type)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${dg ? '<span style="color:#c0392b;font-weight:700">DG</span>' : 'General'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.height_cm ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.width_cm ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.length_cm ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.total_cube_m3 ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.weight_kg ?? '')}</td>
    </tr>`).join('')
  const tU = (d.cargo ?? []).reduce((t, l) => t + (l.units ?? 0), 0)
  const tC = (d.cargo ?? []).reduce((t, l) => t + (l.total_cube_m3 ?? 0), 0)
  const tK = (d.cargo ?? []).reduce((t, l) => t + (l.weight_kg ?? 0), 0)
  return `
  <div style="font-family:Inter,Arial,sans-serif;color:#111;max-width:820px;margin:0 auto;padding:28px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <div style="font-weight:800;font-size:24px;color:#0A2472;letter-spacing:-.5px">UB FREIGHT</div>
      <div style="text-align:center;font-size:13px;line-height:1.6"><div><strong>Consignment ID:</strong> ${esc(d.consignment_no)}</div><div><strong>Date:</strong> ${date}</div></div>
      <img src="${qrUrl}" alt="QR" style="width:92px;height:92px" />
    </div>
    <div style="display:flex;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;margin-top:18px;font-size:13px">
      <div style="flex:1;padding:14px;border-right:1px solid #e5e5e5">
        <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.05em">Sender</div>
        <div style="font-weight:600;margin-top:4px">${esc(d.sender_company)}</div>
        <div style="color:#555;margin-top:4px">${esc(d.sender_address)}</div>
        <div style="color:#777;margin-top:6px;font-size:12px">${esc([d.sender_contact, d.sender_phone].filter(Boolean).join(' · '))}</div>
      </div>
      <div style="flex:1;padding:14px">
        <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:.05em">Receiver</div>
        <div style="font-weight:600;margin-top:4px">${esc(d.receiver_company)}</div>
        <div style="color:#555;margin-top:4px">${esc(d.receiver_address)}</div>
        <div style="color:#777;margin-top:6px;font-size:12px">${esc([d.receiver_contact, d.receiver_phone].filter(Boolean).join(' · '))}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:12px">
      <thead><tr style="background:#0A2472;color:#fff;text-align:left">
        <th style="padding:9px">Items</th><th style="padding:9px">Type of packages</th><th style="padding:9px">DG class</th>
        <th style="padding:9px">H(cm)</th><th style="padding:9px">W(cm)</th><th style="padding:9px">L(cm)</th><th style="padding:9px">Cubic (m³)</th><th style="padding:9px">Kilos</th>
      </tr></thead>
      <tbody>${rows}
        <tr style="border-top:2px solid #0A2472;font-weight:700"><td style="padding:9px">${tU}</td><td></td><td></td><td></td><td></td><td></td><td style="padding:9px">${tC.toFixed(4)}</td><td style="padding:9px">${tK.toFixed(2)}</td></tr>
      </tbody>
    </table>
    <div style="margin-top:18px;display:flex;align-items:center;gap:14px">
      ${goodsBadge(d.goods_type)}
      <span style="font-size:11px;color:#777">The agreement for freighting of goods, hereby evidenced, is subject to the conditions at https://www.ubfreight.com/terms-and-conditions/</span>
    </div>
  </div>`
}

export function buildLabelHtml(d: TmsConsignmentDetail, index: number, total: number, qrUrl: string): string {
  const date = new Date().toLocaleDateString('en-NZ', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `
  <div style="font-family:Inter,Arial,sans-serif;color:#111;width:420px;margin:0 auto;border:1.5px solid #111;border-radius:10px;overflow:hidden;page-break-after:always">
    <div style="display:flex;border-bottom:1.5px solid #111">
      <div style="flex:1;padding:12px;border-right:1.5px solid #111">
        <div style="font-size:10px;color:#888;text-transform:uppercase">From</div>
        <div style="font-weight:700;margin-top:4px">${esc(d.sender_company)}</div>
        <div style="font-size:12px;color:#333;margin-top:2px">${esc(d.sender_address)}</div>
      </div>
      <div style="width:160px;padding:12px">
        <div style="font-weight:800;font-size:15px">NZ AUCKLAND</div>
        <div style="font-size:12px;margin-top:4px">${date}</div>
        <div style="font-size:12px;border-top:1px solid #111;margin-top:8px;padding-top:6px">Total pieces: ${total}</div>
      </div>
    </div>
    <div style="display:flex;border-bottom:1.5px solid #111">
      <div style="flex:1;padding:12px">
        <div style="text-align:right;font-weight:700;font-size:13px">Label ${index} of ${total}</div>
        <div style="font-size:10px;color:#888;text-transform:uppercase;margin-top:6px">Ship to</div>
        <div style="font-weight:600;margin-top:2px">${esc(d.receiver_company)}</div>
        <div style="font-size:12px;color:#333;margin-top:2px">${esc(d.receiver_address)}</div>
      </div>
      <div style="width:150px;padding:12px;text-align:center">
        <div style="font-size:10px;color:#888;text-align:right;margin-bottom:6px">ID: ${esc(d.consignment_no)}</div>
        ${goodsBadge(d.goods_type)}
        <div><img src="${qrUrl}" alt="QR" style="width:92px;height:92px;margin-top:8px" /></div>
      </div>
    </div>
    <div style="text-align:center;font-size:26px;font-weight:800;padding:12px;border-bottom:1.5px solid #111">${esc(d.consignment_no)}</div>
    <div style="padding:9px 12px;font-size:11px;color:#666">Supplier: ${esc(d.supplier_name || 'N/A')} · Ref: ${esc(d.reference || 'N/A')}</div>
  </div>`
}

export function printHtml(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8"><style>@media print{@page{margin:12mm}}body{margin:0;padding:0}</style></head><body>${bodyHtml}</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => { w.print() }, 350)
}
