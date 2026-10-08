import { useEffect, useState, type ReactNode } from 'react'
import { C, NAVY, glass } from '../reportsUi'
import { money, pct } from './financeUtil'

/* ---------- async loader ---------- */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; loading: boolean; error: string | null } {
  const [s, setS] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null })
  useEffect(() => {
    let live = true
    setS((p) => ({ ...p, loading: true, error: null }))
    fn().then((data) => live && setS({ data, loading: false, error: null }))
      .catch((e: Error) => live && setS({ data: null, loading: false, error: e.message }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return s
}

export const Loading = () => <div style={{ padding: 40, textAlign: 'center', color: C.mut, fontSize: 13 }}>Loading…</div>
export const ErrorBox = ({ msg }: { msg: string }) => (
  <div style={{ padding: 14, border: `1px solid ${C.red}`, borderRadius: 10, color: C.red, fontSize: 13, background: '#fff' }}>{msg}</div>
)

const TONE: Record<string, { bg: string; fg: string; bd: string }> = {
  good: { bg: '#ECF8F1', fg: '#137A47', bd: '#BFE6D0' },
  warn: { bg: '#FEF6E7', fg: '#9A5B00', bd: '#F6D8A5' },
  bad: { bg: '#FDEEF1', fg: '#B3123B', bd: '#F5C2CE' },
  info: { bg: '#EEF2FB', fg: NAVY, bd: '#D3DCF2' },
  high: { bg: '#FDEEF1', fg: '#B3123B', bd: '#F5C2CE' },
  medium: { bg: '#FEF6E7', fg: '#9A5B00', bd: '#F6D8A5' },
  low: { bg: '#F4F5F7', fg: '#5B6470', bd: '#E8EAEF' },
}
export const toneColor = (t: string) => TONE[t] ?? TONE.info

export const Banner = ({ tone = 'warn', children }: { tone?: string; children: ReactNode }) => {
  const c = toneColor(tone)
  return <div style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 10, padding: '10px 14px', fontSize: 12.5, lineHeight: 1.5 }}>{children}</div>
}
export const Pill = ({ tone, children }: { tone: string; children: ReactNode }) => {
  const c = toneColor(tone)
  return <span style={{ background: c.bg, color: c.fg, border: `1px solid ${c.bd}`, borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>
}

export const Toggle = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.ink2, cursor: 'pointer', userSelect: 'none' }}>
    <span onClick={() => onChange(!on)} style={{ width: 30, height: 17, borderRadius: 99, background: on ? NAVY : C.faint, position: 'relative', transition: 'background .15s' }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 15 : 2, width: 13, height: 13, borderRadius: 99, background: '#fff', transition: 'left .15s' }} />
    </span>
    <span onClick={() => onChange(!on)}>{label}</span>
  </label>
)

export function MoneyTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string; stroke?: string; fill?: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ ...glass, background: 'rgba(255,255,255,.96)', padding: '10px 12px', borderRadius: 11 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, marginTop: i ? 4 : 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, marginTop: 5, background: p.color ?? p.stroke ?? p.fill }} />
          <span style={{ color: C.ink2 }}>{p.name}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>${money(Number(p.value))}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- financial statement table ---------- */
export type StmtKind = 'section' | 'line' | 'sub' | 'total' | 'pct' | 'memo'
export type StmtRow = { key: string; label: string; kind: StmtKind; values: Record<string, number | null>; onClick?: () => void; note?: string }
export type StmtCol = { key: string; label: string; strong?: boolean; pct?: boolean }

export function StatementTable({ cols, rows, labelWidth = 260 }: { cols: StmtCol[]; rows: StmtRow[]; labelWidth?: number }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            <th style={{ ...thS, textAlign: 'left', minWidth: labelWidth, position: 'sticky', left: 0, background: '#fff' }} />
            {cols.map((c) => <th key={c.key} style={{ ...thS, color: c.strong ? C.ink : C.mut }}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sec = r.kind === 'section', tot = r.kind === 'total', sub = r.kind === 'sub'
            return (
              <tr key={r.key} onClick={r.onClick}
                style={{ cursor: r.onClick ? 'pointer' : 'default', background: tot ? '#F7F8FB' : 'transparent',
                  borderTop: tot || sub ? `1px solid ${C.border}` : undefined, borderBottom: tot ? `1px solid ${C.border}` : `1px solid ${C.line}` }}
                onMouseEnter={(e) => { if (r.onClick) e.currentTarget.style.background = '#F4F6FB' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = tot ? '#F7F8FB' : 'transparent' }}>
                <td title={r.note} style={{ padding: sec ? '14px 12px 6px' : '7px 12px', paddingLeft: r.kind === 'line' || r.kind === 'memo' ? 26 : 12,
                  fontSize: sec ? 11 : 12.5, letterSpacing: sec ? '.06em' : 0, textTransform: sec ? 'uppercase' : 'none',
                  fontWeight: sec || tot || sub ? 600 : 450, color: sec ? C.mut : r.kind === 'memo' || r.kind === 'pct' ? C.ink2 : C.ink,
                  fontStyle: r.kind === 'memo' ? 'italic' : 'normal', position: 'sticky', left: 0, background: 'inherit', whiteSpace: 'nowrap' }}>
                  {r.label}{r.onClick ? <span style={{ color: C.faint, marginLeft: 6 }}>›</span> : null}
                </td>
                {cols.map((c) => {
                  const v = r.values[c.key]
                  const isPct = r.kind === 'pct' || c.pct
                  return (
                    <td key={c.key} style={{ padding: '7px 12px', textAlign: 'right', fontSize: 12.5, whiteSpace: 'nowrap',
                      fontWeight: tot || sub || c.strong ? 600 : 450,
                      color: v != null && v < 0 && !isPct ? C.red : r.kind === 'pct' || r.kind === 'memo' ? C.ink2 : C.ink }}>
                      {sec || v == null ? '' : isPct ? pct(v) : money(v)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
const thS = { fontSize: 10.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' as const, padding: '12px 12px 9px', textAlign: 'right' as const, whiteSpace: 'nowrap' as const }
