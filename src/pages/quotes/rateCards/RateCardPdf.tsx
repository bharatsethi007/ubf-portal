import { Document, Image, Page, Text, View, pdf } from '@react-pdf/renderer'
import { addressLines, getBranding, type Brand } from '../../../features/company/branding'
import { registerQuoteFonts } from '../pdf/quotePdfFonts'
import { allIn, fmtDate, money, toSell, type Line, type Product, type RateCard } from './rateCardModel'
import { s } from './rateCardPdfStyles'

registerQuoteFonts()

const LOGO = '/ub-logo-pdf.png'
const BAND = '/pdf/rate-card-band.jpg'
type Ctx = { portName: (code: string) => string; staffName: (id: string | null) => string; staffEmail?: string | null; brand?: Brand }

const MODE: Record<Product, string> = { FCL: 'Sea freight · FCL', LCL: 'Sea freight · LCL', AIR: 'Air freight' }
const NOTE: Record<Product, string> = {
  FCL: 'Per container. Door to door, including origin handling, NZ port charges, customs clearance and delivery.',
  LCL: 'Per weight or measure (1,000 kg or 1 cbm, whichever is greater). Door to door.',
  AIR: 'Per chargeable kilogram (actual or volumetric, whichever is greater). Door to door.',
}

function Chrome({ c }: { c: RateCard }) {
  return (
    <>
      <View style={s.head} fixed><Image src={LOGO} style={s.headLogo} /><Text style={s.headRef}>RATE CARD · {c.customer.toUpperCase()} · {c.ref}</Text></View>
      <View style={s.foot} fixed>
        <Text>Valid {fmtDate(c.valid_from)} to {fmtDate(c.valid_to)}. Subject to the terms in this rate card.</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  )
}

function Cover({ c, shown, ctx }: { c: RateCard; shown: Line[]; ctx: Ctx }) {
  const counts = (['FCL', 'LCL', 'AIR'] as Product[]).map((p) => [p, shown.filter((l) => l.product === p).length] as const).filter(([, n]) => n)
  const curs = [...new Set(shown.map((l) => l.sell_currency))]
  const toc = [c.presentation === 'freight' ? 'Freight rates by lane' : c.presentation !== 'breakdown' && 'All-in rates by lane', (c.presentation === 'breakdown' || c.presentation === 'both') && 'Rate breakdown', 'Inclusions and terms'].filter(Boolean) as string[]
  return (
    <Page size="A4" style={s.cover}>
      <View style={s.coverTop}>
        <Image src={LOGO} style={s.logo} />
        <Text style={s.coverRef}>{c.ref}{c.version > 1 ? ` · Version ${c.version}` : ''}{'\n'}Issued {fmtDate(c.published_at ?? new Date().toISOString(), true)}</Text>
      </View>
      <View style={s.band}>
        <Image src={BAND} style={s.bandImg} />
        <View style={s.bandText}>
          <Text style={s.kicker}>RATE CARD</Text>
          <Text style={s.coverTitle}>{c.title || counts.map(([p]) => (p === 'AIR' ? 'Air' : p)).join(' and ')}</Text>
          <Text style={s.coverFor}>Prepared for {c.customer}</Text>
        </View>
      </View>
      <View style={s.facts}>
        <View style={s.fact}><Text style={s.cap}>VALID</Text><Text style={s.factV}>{fmtDate(c.valid_from, true)}{'\n'}to {fmtDate(c.valid_to, true)}</Text></View>
        <View style={s.fact}><Text style={s.cap}>COVERS</Text><Text style={s.factV}>{counts.map(([p, n]) => `${n} ${p === 'AIR' ? 'air' : p} lane${n > 1 ? 's' : ''}`).join('\n')}</Text></View>
        <View style={s.fact}><Text style={s.cap}>CURRENCY</Text><Text style={s.factV}>{curs.join(', ')} freight{'\n'}Local charges as shown</Text></View>
      </View>
      <View style={s.toc}>
        <Text style={s.cap}>CONTENTS</Text>
        {toc.map((t) => <View key={t} style={s.tocRow}><Text>{t}</Text></View>)}
      </View>
      <View style={s.coverFoot}>
        <Text>Your contact{'\n'}<Text style={{ color: '#0F172A', fontSize: 10 }}>{ctx.staffName(c.sales_id)}</Text>{ctx.staffEmail ? `\n${ctx.staffEmail}` : ''}</Text>
        <Text style={{ textAlign: 'right' }}>{ctx.brand ? `${ctx.brand.trading_name}\n${addressLines(ctx.brand).join(', ')}` : 'UB Freight Ltd\n173 Montgomerie Road, Airport Oaks, Auckland'}{'\n'}New Zealand · Fiji · Australia</Text>
      </View>
    </Page>
  )
}

function Cell({ w, children, right, strong }: { w: number | string; children: React.ReactNode; right?: boolean; strong?: boolean }) {
  return <Text style={[s.td, { width: w }, right ? s.num : {}, strong ? s.strong : {}]}>{children}</Text>
}
function Head({ cols }: { cols: [string, number | string, boolean?][] }) {
  return <View style={s.th} fixed>{cols.map(([t, w, r]) => <Text key={t} style={[s.thc, { width: w }, r ? s.num : {}]}>{t.toUpperCase()}</Text>)}</View>
}

function AllIn({ c, shown, ctx }: { c: RateCard; shown: Line[]; ctx: Ctx }) {
  const fo = c.presentation === 'freight'
  const price = (l: Line) => (fo ? l.freight_sell : allIn(l, c.fx ?? {}))
  const fx = c.fx ?? {}
  return (
    <View>
      <Text style={s.secCap}>SECTION 1</Text>
      <Text style={s.secTitle}>{fo ? 'Freight rates' : 'All-in rates'}</Text>
      {fo && <Text style={s.secNote}>Freight only, port to port. Origin and destination charges are not included and are quoted per shipment.</Text>}
      {(['FCL', 'LCL', 'AIR'] as Product[]).map((p) => {
        const ls = shown.filter((l) => l.product === p)
        if (!ls.length) return null
        if (p === 'FCL') {
          const ctrs = [...new Set(ls.map((l) => l.container_type ?? ''))].sort()
          const lanes = [...new Map(ls.map((l) => [`${l.origin_code}|${l.dest_code}`, l])).values()]
          const w = `${Math.floor(46 / ctrs.length)}%`
          return (
            <View key={p} wrap={false}>
              <Text style={s.grp}>{MODE[p]}</Text>{!fo && <Text style={s.secNote}>{NOTE[p]}</Text>}
              <Head cols={[['From', '30%'], ['To', '14%'], ...ctrs.map((x) => [x, w, true] as [string, string, boolean]), ['Transit', '10%', true]]} />
              {lanes.map((l) => (
                <View key={`${l.origin_code}${l.dest_code}`} style={s.tr}>
                  <Cell w="30%">{ctx.portName(l.origin_code)}</Cell><Cell w="14%">{ctx.portName(l.dest_code)}</Cell>
                  {ctrs.map((x) => { const m = ls.find((y) => y.origin_code === l.origin_code && y.dest_code === l.dest_code && y.container_type === x); return <Cell key={x} w={w} right strong>{m ? money(price(m), m.sell_currency, 0) : '–'}</Cell> })}
                  <Cell w="10%" right>{l.transit_days ? `${l.transit_days} days` : '–'}</Cell>
                </View>
              ))}
            </View>
          )
        }
        return (
          <View key={p} wrap={false}>
            <Text style={s.grp}>{MODE[p]}</Text>{!fo && <Text style={s.secNote}>{NOTE[p]}</Text>}
            <Head cols={[['From', '30%'], ['To', '20%'], [p === 'LCL' ? 'Per w/m' : 'Per kg', '16%', true], ['Minimum', '16%', true], ['Transit', '18%', true]]} />
            {ls.map((l, i) => (
              <View key={i} style={s.tr}>
                <Cell w="30%">{ctx.portName(l.origin_code)}</Cell><Cell w="20%">{ctx.portName(l.dest_code)}</Cell>
                <Cell w="16%" right strong>{money(price(l), l.sell_currency, 2)}</Cell>
                <Cell w="16%" right>{l.sell_min ? money(l.sell_min, l.sell_currency, 0) : '–'}</Cell>
                <Cell w="18%" right>{l.transit_days ? `${l.transit_days} days` : '–'}{l.frequency ? ` · ${l.frequency}` : ''}</Cell>
              </View>
            ))}
          </View>
        )
      })}
      {!fo && fxNote(shown, fx) && <Text style={[s.secNote, { marginTop: 10 }]}>{fxNote(shown, fx)}</Text>}
    </View>
  )
}

function fxNote(shown: Line[], fx: Record<string, number>): string | null {
  const sc = shown[0]?.sell_currency
  const others = [...new Set(shown.flatMap((l) => [l.origin_currency, l.dest_currency]))].filter((k): k is string => !!k && k !== sc && !!fx[k])
  if (!sc || !others.length) return null
  return `All-in converts local charges at ${others.map((k) => `1 ${k} = ${fx[k].toFixed(4)} ${sc}`).join(', ')}. Invoiced at the rate on invoice date.`
}

function Breakdown({ c, shown, ctx, n }: { c: RateCard; shown: Line[]; ctx: Ctx; n: number }) {
  const fx = c.fx ?? {}
  return (
    <View break={c.presentation === 'both'}>
      <Text style={s.secCap}>SECTION {n}</Text>
      <Text style={s.secTitle}>Rate breakdown</Text>
      <Text style={s.secNote}>What makes up each all-in rate, from origin to your door.</Text>
      <Head cols={[['Lane', '30%'], ['Unit', '12%'], ['Origin', '13%', true], ['Freight', '15%', true], ['NZ charges', '16%', true], ['All-in', '14%', true]]} />
      {shown.map((l, i) => (
        <View key={i} style={s.tr} wrap={false}>
          <Cell w="30%">{ctx.portName(l.origin_code)} to {ctx.portName(l.dest_code)}</Cell>
          <Cell w="12%">{l.product === 'FCL' ? l.container_type : l.product === 'LCL' ? 'per w/m' : 'per kg'}</Cell>
          <Cell w="13%" right>{money(l.origin_sell, l.origin_currency ?? l.sell_currency)}</Cell>
          <Cell w="15%" right>{money(l.freight_sell, l.sell_currency)}</Cell>
          <Cell w="16%" right>{money(l.dest_sell, l.dest_currency ?? l.sell_currency)}</Cell>
          <Cell w="14%" right strong>{money(allIn(l, fx) ?? toSell(l.freight_sell, l.sell_currency, l.sell_currency, fx), l.sell_currency)}</Cell>
        </View>
      ))}
    </View>
  )
}

function Terms({ c, n }: { c: RateCard; n: number }) {
  return (
    <View wrap={false} style={{ marginTop: 22 }}>
      <Text style={s.secCap}>SECTION {n}</Text>
      <Text style={s.secTitle}>Inclusions and terms</Text>
      <View style={s.cols}>
        <View style={s.col}><Text style={s.colT}>Included</Text><Text style={s.colB}>{c.included ?? ''}</Text></View>
        <View style={s.col}><Text style={s.colT}>Not included</Text><Text style={s.colB}>{c.excluded ?? ''}</Text></View>
      </View>
      <View style={{ marginTop: 12 }}><Text style={s.colT}>Terms</Text><Text style={s.colB}>{c.terms ?? ''}</Text></View>
    </View>
  )
}

export function RateCardDocument({ c, lines, ctx }: { c: RateCard; lines: Line[]; ctx: Ctx }) {
  const shown = lines.filter((l) => l.show && l.freight_sell != null)
  const showAll = c.presentation !== 'breakdown'
  const showBd = c.presentation === 'breakdown' || c.presentation === 'both'
  return (
    <Document title={`UB Freight Rate Card ${c.ref} ${c.customer}`} author="UB Freight Ltd">
      <Cover c={c} shown={shown} ctx={ctx} />
      <Page size="A4" style={s.page}>
        <Chrome c={c} />
        {showAll && <AllIn c={c} shown={shown} ctx={ctx} />}
        {showBd && <Breakdown c={c} shown={shown} ctx={ctx} n={showAll ? 2 : 1} />}
        <Terms c={c} n={(showAll ? 1 : 0) + (showBd ? 1 : 0) + 1} />
      </Page>
    </Document>
  )
}

export const rateCardFileName = (c: RateCard) => `UBF Rate Card ${c.ref} ${c.customer.replace(/[^\w\s-]/g, '').trim()}.pdf`

export async function rateCardPdfBlob(c: RateCard, lines: Line[], ctx: Ctx): Promise<Blob> {
  const rc = c as unknown as { company_id?: string | null; branch_id?: string | null }
  const brand = ctx.brand ?? await getBranding(rc.company_id, rc.branch_id)
  return pdf(<RateCardDocument c={c} lines={lines} ctx={{ ...ctx, brand }} />).toBlob()
}

export async function downloadRateCardPdf(c: RateCard, lines: Line[], ctx: Ctx): Promise<void> {
  const url = URL.createObjectURL(await rateCardPdfBlob(c, lines, ctx))
  const a = document.createElement('a'); a.href = url; a.download = rateCardFileName(c); a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function previewRateCardPdf(c: RateCard, lines: Line[], ctx: Ctx): Promise<void> {
  window.open(URL.createObjectURL(await rateCardPdfBlob(c, lines, ctx)), '_blank', 'noopener')
}
