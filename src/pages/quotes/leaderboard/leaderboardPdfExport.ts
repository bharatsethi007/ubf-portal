import { createElement } from 'react'
import type { Leaderboard } from './leaderboardApi'

// Lazy-loads react-pdf so the quotes page bundle stays small.
export async function downloadLeaderboardPdf(lb: Leaderboard, periodLabel: string, modeText: string, generatedBy?: string) {
  const [{ pdf }, { default: LeaderboardPdf }, { registerQuoteFonts }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./LeaderboardPdf'),
    import('../pdf/quotePdfFonts'),
  ])
  registerQuoteFonts()
  const doc = createElement(LeaderboardPdf, { lb, periodLabel, modeText, logoUrl: '/ub-logo-pdf.png', generatedBy })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(doc as any).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ubf-quotes-leaderboard-${periodLabel.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.pdf`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
