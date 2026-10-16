import { Document, Font, Page, Text, View, pdf } from '@react-pdf/renderer'
import { registerQuoteFonts } from '../../quotes/pdf/quotePdfFonts'
import { CLAUSES, PURPOSE, RECITALS } from './agreementClauses'
import type { Agreement } from './agreementModel'
import { Cover, Execution, PageChrome, Schedule } from './AgreementPdfParts'
import { s } from './agreementPdfStyles'

registerQuoteFonts()
Font.register({ family: 'Signature', src: '/fonts/pdf/GreatVibes-Regular.ttf' })

/** The full agreement: cover, parties, recitals, clauses 1 to 19, Schedule 1, execution. */
export function AgreementDocument({ a, sigImage }: { a: Agreement; sigImage?: string | null }) {
  return (
    <Document title={`UB Freight Agency Agreement ${a.ref}`} author="UB Freight Ltd">
      <Page size="A4" style={s.cover}>
        <Cover a={a} />
      </Page>
      <Page size="A4" style={s.page}>
        <PageChrome a={a} />
        <View style={s.h}><Text style={s.ht}>Purpose</Text></View>
        <Text style={s.p}>{PURPOSE}</Text>

        <View style={s.h}><Text style={s.ht}>Parties and background</Text></View>
        <Text style={s.p}>This Agency Co-operation Agreement (Agreement) is entered into between:</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <View style={s.partyBox}>
            <Text style={s.cap}>UB FREIGHT</Text>
            <Text style={{ fontSize: 9.5, marginBottom: 2 }}>UB Freight Ltd</Text>
            <Text style={{ fontSize: 8, color: '#475467' }}>173 Montgomerie Road, Airport Oaks, Auckland 2022, New Zealand, together with its relevant regional offices and operating entities (UB Freight).</Text>
          </View>
          <View style={s.partyBox}>
            <Text style={s.cap}>AGENT</Text>
            <Text style={{ fontSize: 9.5, marginBottom: 2 }}>{a.agent_legal_name ?? ''}</Text>
            <Text style={{ fontSize: 8, color: '#475467' }}>
              {a.agent_address ?? ''}{a.signatory_name ? `, represented by ${a.signatory_name}` : ''} (Agent).
            </Text>
          </View>
        </View>
        <Text style={s.p}>UB Freight and the Agent are each a Party and together the Parties.</Text>

        <View style={s.h}><Text style={s.ht}>Recitals</Text></View>
        {RECITALS.map((r, i) => (
          <View key={i} style={s.cl}><Text style={s.cn}>{String.fromCharCode(65 + i)}</Text><Text style={s.ct}>{r}</Text></View>
        ))}

        {CLAUSES.map((c) => (
          <View key={c.n}>
            <View wrap={false}>
              <View style={s.h}><Text style={s.hn}>{String(c.n).padStart(2, '0')}</Text><Text style={s.ht}>{c.title}</Text></View>
              <View style={s.cl}><Text style={s.cn}>{c.items[0][0]}</Text><Text style={s.ct}>{c.items[0][1]}</Text></View>
            </View>
            {c.items.slice(1).map(([n, t]) => (
              <View key={n} style={s.cl} wrap={false}><Text style={s.cn}>{n}</Text><Text style={s.ct}>{t}</Text></View>
            ))}
          </View>
        ))}

        <Schedule a={a} />
        <Execution a={a} sigImage={sigImage} />
      </Page>
    </Document>
  )
}

export async function agreementPdfBlob(a: Agreement, sigImage?: string | null): Promise<Blob> {
  return pdf(<AgreementDocument a={a} sigImage={sigImage} />).toBlob()
}

export function agreementFileName(a: Agreement): string {
  const name = (a.agent_legal_name ?? 'Agent').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, ' ')
  return `UBF Agency Agreement ${a.ref} ${name}.pdf`
}

export async function downloadAgreementPdf(a: Agreement): Promise<void> {
  const blob = await agreementPdfBlob(a)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = agreementFileName(a)
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function previewAgreementPdf(a: Agreement): Promise<void> {
  const blob = await agreementPdfBlob(a)
  window.open(URL.createObjectURL(blob), '_blank', 'noopener')
}
