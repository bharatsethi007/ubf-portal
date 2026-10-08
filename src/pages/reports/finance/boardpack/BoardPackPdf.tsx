import { Document } from '@react-pdf/renderer'
import { registerQuoteFonts } from '../../../quotes/pdf/quotePdfFonts'
import type { BoardPack } from './boardPackData'
import { fullMonth } from './bpKit'
import { Commentary, Cover, Glance } from './bpPagesA'
import { Balance, Cash, Margins, Pnl, WorkingCapital } from './bpPagesB'

registerQuoteFonts()

export default function BoardPackPdf({ p }: { p: BoardPack }) {
  return (
    <Document title={`UB Freight board pack ${fullMonth(p.month)}`} author="UB Freight" subject="Monthly management accounts">
      <Cover p={p} />
      <Glance p={p} />
      <Commentary p={p} />
      <Pnl p={p} />
      <Balance p={p} />
      <Cash p={p} />
      <WorkingCapital p={p} />
      <Margins p={p} />
    </Document>
  )
}
