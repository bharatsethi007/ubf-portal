import type { PricingMix, TrendWeek } from './leaderboardApi'
import { conversion, pricingSplit } from './leaderboardApi'
import { fmtPct } from './leaderboardFormat'

const NAVY = '#0A2472'
const tone = (n: number) => (n >= 50 ? '#047857' : n >= 25 ? '#B45309' : '#B91C1C')

/** Won out of every quote. Shown as the main number: it never looks better because quotes are still open. */
export function ConversionBar({ won, quotes }: { won: number; quotes: number }) {
  const v = conversion(won, quotes)
  if (v == null) return <span className="text-slate-400">–</span>
  return (
    <span className="inline-flex items-center gap-2" title={`${won} won of ${quotes} quotes`}>
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, v)}%`, background: tone(v) }} />
      </span>
      <span className="w-10 text-right tabular-nums text-slate-900">{fmtPct(v)}</span>
    </span>
  )
}

/** Won vs lost only, with how many were decided so a 100% from 1 quote reads as what it is. */
export function DecidedRate({ rate, won, lost }: { rate: number | null; won: number; lost: number }) {
  const decided = won + lost
  if (!decided || rate == null) return <span className="text-slate-400">–</span>
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap" title={`${won} won, ${lost} lost`}>
      <span className="tabular-nums text-slate-900">{fmtPct(rate)}</span>
      <span className="text-[11px] text-slate-400">of {decided}</span>
    </span>
  )
}

const wkLabel = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })

/** Pooled conversion of settled weeks: those old enough for customers to have answered. */
export function settledRate(trend: TrendWeek[] | null | undefined) {
  const s = (trend ?? []).filter((w) => w.settled)
  const q = s.reduce((a, w) => a + w.quotes, 0)
  const won = s.reduce((a, w) => a + w.won, 0)
  return { rate: conversion(won, q), quotes: q, won }
}

/**
 * 8 weekly bars, height = conversion that week. Settled weeks solid, recent weeks faded
 * because their customers are still deciding. Number = conversion across settled weeks.
 */
export function TrendSpark({ trend }: { trend: TrendWeek[] | null | undefined }) {
  if (!trend?.length) return <span className="text-slate-400">–</span>
  const H = 22, W = 7, G = 3
  const s = settledRate(trend)
  const tip = trend.map((w) => `${wkLabel(w.week)}: ${w.won}/${w.quotes} won${w.settled ? '' : ' (still deciding)'}`).join('\n')
  return (
    <span className="inline-flex items-center gap-2" title={`${tip}\n\nSettled weeks: ${s.won} won of ${s.quotes}`}>
      <svg width={trend.length * (W + G) - G} height={H} aria-hidden="true">
        {trend.map((w, i) => {
          const v = w.quotes ? w.won / w.quotes : 0
          const h = w.quotes ? Math.max(2, v * H) : 0
          return (
            <g key={w.week}>
              <rect x={i * (W + G)} y={H - 2} width={W} height={2} rx={1} fill="#EEF1F6" />
              {w.quotes > 0 && (
                <rect x={i * (W + G)} y={H - h} width={W} height={h} rx={1.5} fill={NAVY} opacity={w.settled ? 0.9 : 0.25} />
              )}
            </g>
          )
        })}
      </svg>
      <span className="w-9 text-right text-xs tabular-nums text-slate-600">{fmtPct(s.rate)}</span>
    </span>
  )
}

export const PRICING_COLORS = { card: NAVY, other: '#5B8DEF', manual: '#E8A33D' }

/** Card / other / typed-by-hand split of tracked quote lines. */
export function PricingBar({ p }: { p: PricingMix | null | undefined }) {
  const s = pricingSplit(p)
  if (!s) {
    const old = Number(p?.legacy) || 0
    return <span className="text-xs text-slate-400" title={old ? `${old} lines saved before tracking started` : undefined}>{old ? 'Not tracked yet' : '–'}</span>
  }
  const tip = [
    `Rate card: ${p!.card} lines`,
    `Cartage, template, lane history: ${p!.other} lines`,
    `Typed by hand: ${p!.manual} lines`,
    s.cardLines ? `${s.cardEdited} of ${s.cardLines} card prices changed by hand` : '',
    s.legacy ? `${s.legacy} older lines not tracked` : '',
  ].filter(Boolean).join('\n')
  return (
    <span className="inline-flex items-center gap-2" title={tip}>
      <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <span style={{ width: `${s.card}%`, background: PRICING_COLORS.card }} />
        <span style={{ width: `${s.other}%`, background: PRICING_COLORS.other }} />
        <span style={{ width: `${s.manual}%`, background: PRICING_COLORS.manual }} />
      </span>
      <span className="whitespace-nowrap text-xs tabular-nums text-slate-600">{s.card}% card</span>
    </span>
  )
}

export function PricingLegend() {
  const dot = (c: string, l: string) => (
    <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
  )
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      {dot(PRICING_COLORS.card, 'Rate card')}{dot(PRICING_COLORS.other, 'Cartage / template / history')}{dot(PRICING_COLORS.manual, 'Typed by hand')}
    </span>
  )
}

