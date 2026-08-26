import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import type { TmsConsignmentDetail } from './tmsApi'

export async function qr(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { margin: 1, width: 240 })
}

export function barcode(text: string): string {
  try {
    const canvas = document.createElement('canvas')
    JsBarcode(canvas, text, { format: 'CODE128', displayValue: true, fontSize: 18, height: 70, margin: 4 })
    return canvas.toDataURL('image/png')
  } catch { return '' }
}

const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
const MODE: Record<string, string> = { EA: 'EXPORT AIR', ES: 'EXPORT SEA', IA: 'IMPORT AIR', IS: 'IMPORT SEA' }
const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : '')

const boxG = `<svg width="46" height="46" viewBox="0 0 100 100"><rect x="4" y="4" width="92" height="92" fill="none" stroke="#111" stroke-width="7"/><text x="50" y="74" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="66" fill="#111">G</text></svg>`
const boxDG = `<svg width="58" height="46" viewBox="0 0 130 100"><rect x="4" y="4" width="122" height="92" fill="none" stroke="#e11d1d" stroke-width="7"/><text x="65" y="74" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="56" fill="#e11d1d">DG</text></svg>`
const boxFragile = `<svg width="52" height="52" viewBox="0 0 100 100"><rect x="3" y="3" width="94" height="94" fill="none" stroke="#111" stroke-width="6"/><path d="M33 16 H67 Q69 42 50 58 Q31 42 33 16 Z" fill="#111"/><path d="M53 16 L44 36 L55 36 L46 58" fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><rect x="47" y="58" width="6" height="24" fill="#111"/><path d="M35 86 Q50 78 65 86 L63 90 H37 Z" fill="#111"/></svg>`

function markers(d: any): string {
  const goods = d.goods_type === 'dangerous' ? boxDG : boxG
  const frag = d.fragile ? boxFragile : ''
  return `<div style="display:flex;gap:10px;align-items:center">${goods}${frag}</div>`
}

function refFooter(d: any): string {
  const parts = [
    d.reference ? `Ref: ${esc(d.reference)}` : '',
    d.po_number ? `PO: ${esc(d.po_number)}` : '',
    d.booking?.booking_ref ? `Booking: ${esc(d.booking.booking_ref)}` : '',
    d.shipment_ref ? `Shipment: ${esc(d.shipment_ref)}` : (d.job_unique != null ? `Shipment: #${esc(d.job_unique)}` : ''),
  ].filter(Boolean)
  return parts.length ? parts.join('  ·  ') : ''
}

export function buildNoteHtml(d: TmsConsignmentDetail, opts: { qrUrl: string; barcodeUrl: string; logoUrl: string }): string {
  const x = d as any
  const dg = d.goods_type === 'dangerous'
  const rows = (d.cargo ?? []).map((l) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.units ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.type)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${dg ? '<b style="color:#e11d1d">DG</b>' : 'General'}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.height_cm ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.width_cm ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.length_cm ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.total_cube_m3 ?? '')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(l.weight_kg ?? '')}</td>
    </tr>`).join('')
  const tU = (d.cargo ?? []).reduce((t, l) => t + (l.units ?? 0), 0)
  const tC = (d.cargo ?? []).reduce((t, l) => t + (l.total_cube_m3 ?? 0), 0)
  const tK = (d.cargo ?? []).reduce((t, l) => t + (l.weight_kg ?? 0), 0)
  const foot = refFooter(x)
  return `
  <div style="font-family:Inter,Arial,sans-serif;color:#111;max-width:820px;margin:0 auto;padding:28px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px">
      <img src="${opts.logoUrl}" alt="UB Freight" style="height:46px" />
      <div style="text-align:center;font-size:13px;line-height:1.6">
        <div><b>Consignment ID:</b> ${esc(d.consignment_no)}</div>
        <div><b>Pickup:</b> ${fmtDate(x.picked_up_at ?? x.preferred_pickup_at) || '—'}</div>
        ${x.mode ? `<div style="margin-top:4px;display:inline-block;background:#111;color:#fff;font-weight:800;font-size:11px;letter-spacing:.08em;padding:3px 8px">${MODE[x.mode]}</div>` : ''}
      </div>
      <img src="${opts.qrUrl}" alt="QR" style="width:88px;height:88px" />
    </div>
    <div style="display:flex;border:1.5px solid #111;margin-top:18px;font-size:13px">
      <div style="flex:1;padding:14px;border-right:1.5px solid #111">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em">Sender</div>
        <div style="font-weight:700;margin-top:4px">${esc(d.sender_company)}</div>
        <div style="color:#444;margin-top:4px">${esc(d.sender_address)}</div>
        <div style="color:#666;margin-top:6px;font-size:12px">${esc([x.sender_contact, x.sender_phone].filter(Boolean).join(' · '))}</div>
      </div>
      <div style="flex:1;padding:14px">
        <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.05em">Receiver</div>
        <div style="font-weight:700;margin-top:4px">${esc(d.receiver_company)}</div>
        <div style="color:#444;margin-top:4px">${esc(d.receiver_address)}</div>
        <div style="color:#666;margin-top:6px;font-size:12px">${esc([d.receiver_contact, d.receiver_phone].filter(Boolean).join(' · '))}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:12px">
      <thead><tr style="background:#0A2472;color:#fff;text-align:left">
        <th style="padding:9px">Items</th><th style="padding:9px">Type</th><th style="padding:9px">DG class</th>
        <th style="padding:9px">H(cm)</th><th style="padding:9px">W(cm)</th><th style="padding:9px">L(cm)</th><th style="padding:9px">Cubic (m³)</th><th style="padding:9px">Kilos</th>
      </tr></thead>
      <tbody>${rows}
        <tr style="border-top:2px solid #0A2472;font-weight:700"><td style="padding:9px">${tU}</td><td></td><td></td><td></td><td></td><td></td><td style="padding:9px">${tC.toFixed(4)}</td><td style="padding:9px">${tK.toFixed(2)}</td></tr>
      </tbody>
    </table>
    <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px">
      ${markers(x)}
      <img src="${opts.barcodeUrl}" alt="barcode" style="height:70px" />
    </div>
    ${foot ? `<div style="margin-top:12px;padding-top:8px;border-top:1px solid #ddd;font-size:11px;color:#666">${foot}</div>` : ''}
    <div style="margin-top:10px;font-size:10px;color:#999">The agreement for freighting of goods, hereby evidenced, is subject to the conditions at ubfreight.com/terms-and-conditions</div>
  </div>`
}

export function buildLabelHtml(d: TmsConsignmentDetail, index: number, total: number, opts: { pieceQrUrl: string; barcodeUrl: string; logoUrl: string }): string {
  const x = d as any
  const foot = refFooter(x)
  const modeLabel = x.mode ? MODE[x.mode] : ''
  return `
  <div style="font-family:Inter,Arial,sans-serif;color:#111;width:420px;margin:0 auto;border:3px solid #111;background:#fff">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:3px solid #111">
      <img src="${opts.logoUrl}" alt="UB Freight" style="height:28px" />
      <div style="display:flex;align-items:center;gap:8px">
        ${modeLabel ? `<span style="background:#111;color:#fff;font-weight:800;font-size:11px;letter-spacing:.06em;padding:4px 8px">${modeLabel}</span>` : ''}
        <span style="font-weight:800;font-size:15px">${index} of ${total}</span>
      </div>
    </div>
    <div style="padding:8px 12px;border-bottom:2px solid #111">
      <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.05em">From</div>
      <div style="font-weight:700;margin-top:1px">${esc(d.sender_company)}</div>
      <div style="font-size:12px;color:#444">${esc(d.sender_address)}</div>
      <div style="font-size:12px;color:#444">${esc([x.sender_contact, x.sender_phone].filter(Boolean).join(' · '))}</div>
      <div style="font-size:11px;color:#666;margin-top:4px">Pickup: ${fmtDate(x.picked_up_at ?? x.preferred_pickup_at) || '—'}</div>
    </div>
    <div style="display:flex;border-bottom:3px solid #111">
      <div style="flex:1;padding:10px 12px">
        <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.05em">Ship to</div>
        <div style="font-weight:800;font-size:24px;line-height:1.1;margin-top:2px">${esc(d.receiver_company)}</div>
        <div style="font-size:14px;color:#222;margin-top:3px">${esc(d.receiver_address)}</div>
        <div style="margin-top:12px">${markers(x)}</div>
      </div>
      <div style="width:128px;padding:10px;text-align:center;border-left:2px solid #111">
        <div style="font-size:9px;color:#666;letter-spacing:.08em">PIECE</div>
        <img src="${opts.pieceQrUrl}" alt="piece" style="width:100px;height:100px" />
        <div style="font-size:12px;font-weight:700">${index}/${total}</div>
      </div>
    </div>
    <div style="text-align:center;font-weight:800;font-size:30px;letter-spacing:1px;padding:10px;border-bottom:3px solid #111">${esc(d.consignment_no)}</div>
    <div style="padding:10px 12px;text-align:center">
      <img src="${opts.barcodeUrl}" alt="consignment" style="height:70px;max-width:100%" />
    </div>
    ${foot ? `<div style="padding:6px 12px 10px;font-size:10px;color:#666;border-top:1px solid #ccc">${foot}</div>` : ''}
  </div>`
}

export function printHtml(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) return
  w.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8"><style>@media print{@page{margin:12mm}}body{margin:0;padding:0}</style></head><body>${bodyHtml}</body></html>`)
  w.document.close(); w.focus()
  setTimeout(() => { w.print() }, 400)
}

export function printLabels(labelsHtml: string[], size: 'a4' | 'thermal') {
  const w = window.open('', '_blank', 'width=900,height=1000')
  if (!w) return
  const pageCss = size === 'thermal'
    ? `@page{size:100mm 150mm;margin:0}
       html,body{margin:0;padding:0}
       .label-page{width:100mm;height:150mm;box-sizing:border-box;padding:3mm;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}
       .label-page:last-child{page-break-after:avoid}
       .label-page > *{width:100%!important}`
    : `@page{size:A4;margin:8mm}
       html,body{margin:0;padding:0}
       .label-page{width:194mm;height:281mm;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden;page-break-after:always}
       .label-page:last-child{page-break-after:avoid}
       .label-scale{width:420px}
       .label-scale > *{width:420px!important}`
  const wrap = (l: string) =>
    size === 'a4'
      ? `<div class="label-page"><div class="label-scale">${l}</div></div>`
      : `<div class="label-page">${l}</div>`
  const body = labelsHtml.map(wrap).join('')
  const fitScript = size === 'a4'
    ? `<script>window.addEventListener('load',function(){
         document.querySelectorAll('.label-page').forEach(function(pg){
           var s=pg.querySelector('.label-scale'); if(!s) return;
           var avW=pg.clientWidth, avH=pg.clientHeight;
           var natW=s.offsetWidth, natH=s.offsetHeight;
           if(!natW||!natH) return;
           var k=Math.min(avW/natW, avH/natH)*0.98;
           s.style.transformOrigin='center center';
           s.style.transform='scale('+k+')';
         });
         setTimeout(function(){window.print();},300);
       });<\/script>`
    : `<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});<\/script>`
  w.document.write(`<!doctype html><html><head><title>Labels</title><meta charset="utf-8"><style>${pageCss}</style></head><body>${body}${fitScript}</body></html>`)
  w.document.close(); w.focus()
}
