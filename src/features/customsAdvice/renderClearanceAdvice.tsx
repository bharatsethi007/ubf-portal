import { Font, pdf } from '@react-pdf/renderer'
import ClearanceAdvicePdf from './ClearanceAdvicePdf'
import { fetchClearanceAdvice } from './clearanceAdviceApi'

let fonts = false
function registerFonts() {
  if (fonts) return
  fonts = true
  Font.register({ family: 'General Sans', fonts: [
    { src: '/fonts/pdf/GeneralSans-400.ttf', fontWeight: 400 },
    { src: '/fonts/pdf/GeneralSans-500.ttf', fontWeight: 500 },
    { src: '/fonts/pdf/GeneralSans-600.ttf', fontWeight: 600 },
    { src: '/fonts/pdf/GeneralSans-700.ttf', fontWeight: 700 },
  ] })
  Font.registerHyphenationCallback((w) => [w])
}

/** Builds the UBF Clearance Advice PDF (Customs + MPI) for a booking. Caller revokes the URL. */
export async function buildClearanceAdvice(
  bookingId: string,
  bookingRef: string | null,
): Promise<{ url: string; title: string }> {
  const data = await fetchClearanceAdvice(bookingId, bookingRef)
  registerFonts()
  const blob = await pdf(
    <ClearanceAdvicePdf data={data} logo="/ub-logo-pdf.png" generatedAt={new Date().toISOString()} />,
  ).toBlob()
  return {
    url: URL.createObjectURL(blob),
    title: `UBF Clearance Advice ${data.entry.entry_number ?? data.entry.job_unique}`,
  }
}
