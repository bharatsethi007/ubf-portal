import { supabase } from '../../../../../supabase'
import { todayIso } from '../../homeModel'
import type { Statement } from './statementModel'

export * from './statementModel'

export async function fetchStatement(): Promise<Statement> {
  const { data, error } = await supabase.rpc('portal_statement')
  if (error || !data) throw new Error('Statement could not load.')
  const s = data as Statement
  return { ...s, items: (s.items ?? []).map((i) => ({ ...i, amount: Number(i.amount) || 0, balance: Number(i.balance) || 0 })) }
}

/** Builds the duplicate statement PDF in the browser and saves it. */
export async function downloadStatementPdf(): Promise<void> {
  const [st, mod] = await Promise.all([fetchStatement(), import('./renderInvoicePdf')])
  const blob = await mod.renderStatementPdf(st, todayIso())
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `UB Freight statement ${st.account_id} ${todayIso()} (copy).pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
