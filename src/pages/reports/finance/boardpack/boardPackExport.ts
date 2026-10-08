import { createElement } from 'react'

// Builds the board pack for a month and downloads it. Libraries load on demand to keep the Reports bundle small.
export async function downloadBoardPack(month: string, useAdj: boolean) {
  const [{ pdf }, { buildBoardPack }, { default: BoardPackPdf }] = await Promise.all([
    import('@react-pdf/renderer'), import('./boardPackData'), import('./BoardPackPdf'),
  ])
  const data = await buildBoardPack(month, useAdj)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blob = await pdf(createElement(BoardPackPdf, { p: data }) as any).toBlob()
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: `UBF_Board_Pack_${month.slice(0, 7)}.pdf` })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
