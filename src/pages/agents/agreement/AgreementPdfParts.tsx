import { Image, Text, View } from '@react-pdf/renderer'
import { OFFICES, type Agreement } from './agreementModel'
import { s, NAVY } from './agreementPdfStyles'

export const LOGO = '/ub-logo-pdf.png'

function stamp(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' NZT'
}

export function fmtLong(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function PageChrome({ a }: { a: Agreement }) {
  return (
    <>
      <View style={s.head} fixed>
        <Image src={LOGO} style={s.headLogo} />
        <Text style={s.headText}>AGENCY CO-OPERATION AGREEMENT · {a.ref}</Text>
      </View>
      <View style={s.foot} fixed>
        <Text>CONFIDENTIAL · UB Freight Ltd</Text>
        <Text>Initials: UBF ____  Agent ____</Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </>
  )
}

/** Cover: navy band, parties, dates, offices covered. */
export function Cover({ a }: { a: Agreement }) {
  const offices = OFFICES.filter((o) => a.offices.includes(o.code))
  return (
    <>
      <View style={s.band}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Image src={LOGO} style={s.logo} />
          <Text style={s.ref}>{a.ref}{'\n'}{a.kind === 'exclusive' ? 'Exclusive' : 'Non-exclusive'} · reciprocal</Text>
        </View>
        <View>
          <Text style={s.eyebrow}>AGENCY CO-OPERATION AGREEMENT</Text>
          <Text style={s.title}>A reciprocal{'\n'}partnership for{'\n'}Pacific freight.</Text>
        </View>
      </View>
      <View style={s.stripe} />
      <View style={{ flexDirection: 'row', paddingHorizontal: 54, paddingTop: 28 }}>
        <View style={{ flex: 1, paddingRight: 18 }}>
          <Text style={s.cap}>PRINCIPAL</Text>
          <Text style={s.partyName}>UB Freight Ltd</Text>
          <Text style={s.partyAddr}>173 Montgomerie Road, Airport Oaks{'\n'}Auckland 2022, New Zealand</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.cap}>AGENT</Text>
          <Text style={s.partyName}>{a.agent_legal_name ?? ''}</Text>
          <Text style={s.partyAddr}>{a.agent_address ?? ''}</Text>
        </View>
      </View>
      <View style={s.boxRow}>
        <View style={[s.boxCell, { borderRightWidth: 1, borderRightColor: '#E6E8EE' }]}><Text style={s.cap}>EFFECTIVE</Text><Text style={s.boxVal}>{fmtLong(a.effective_date)}</Text></View>
        <View style={[s.boxCell, { borderRightWidth: 1, borderRightColor: '#E6E8EE' }]}><Text style={s.cap}>EXPIRES</Text><Text style={s.boxVal}>{fmtLong(a.expiry_date)}</Text></View>
        <View style={s.boxCell}><Text style={s.cap}>BASIS</Text><Text style={s.boxVal}>{a.kind === 'exclusive' ? 'Exclusive' : 'Non-exclusive'}</Text></View>
      </View>
      <View style={{ paddingHorizontal: 54, paddingTop: 22 }}><Text style={s.cap}>UB FREIGHT OFFICES COVERED</Text></View>
      <View style={s.officeRow}>
        {offices.map((o) => (
          <View key={o.code} style={s.office}>
            <Text style={{ fontSize: 10, marginBottom: 2 }}>{o.country}</Text>
            <Text style={{ fontSize: 8, color: '#5B6474' }}>{o.detail}</Text>
          </View>
        ))}
      </View>
      <View style={s.coverFoot}>
        <Text>CONFIDENTIAL · UB Freight Ltd · ubfreight.com</Text>
        <Text>Prepared {fmtLong(a.created_at)}</Text>
      </View>
    </>
  )
}

function Row({ k, u, v }: { k: string; u: string; v: string }) {
  return (
    <View style={s.tr} wrap={false}>
      <Text style={s.tk}>{k}</Text><Text style={s.tv}>{u}</Text><Text style={s.tv}>{v || '—'}</Text>
    </View>
  )
}

/** Schedule 1: commercial and contact details, both parties side by side. */
export function Schedule({ a }: { a: Agreement }) {
  const offices = OFFICES.filter((o) => a.offices.includes(o.code)).map((o) => `${o.country}: ${o.detail}`).join('\n')
  const u = a.ubf_contacts ?? {}, g = a.agent_contacts ?? {}
  const validity = `${fmtLong(a.effective_date)} to ${fmtLong(a.expiry_date)}`
  return (
    <View break>
      <Text style={{ fontSize: 8, letterSpacing: 1.6, color: '#E8742A' }}>SCHEDULE 1</Text>
      <Text style={{ fontSize: 17, color: NAVY, marginTop: 2, marginBottom: 4 }}>Commercial and contact details</Text>
      <Text style={[s.p, { color: '#475467' }]}>Where a field is blank, the main body of the Agreement applies.</Text>
      <View style={{ borderWidth: 1, borderColor: '#E6E8EE', borderRadius: 4 }}>
        <View style={s.th}><Text style={{ width: 130, padding: 6 }}>ITEM</Text><Text style={{ flex: 1, padding: 6 }}>UB FREIGHT LTD</Text><Text style={{ flex: 1, padding: 6 }}>AGENT</Text></View>
        <Row k="Legal entity" u="UB Freight Ltd" v={a.agent_legal_name ?? ''} />
        <Row k="Registered address" u="173 Montgomerie Road, Airport Oaks, Auckland 2022, New Zealand" v={a.agent_address ?? ''} />
        <Row k="Company number" u="NZBN on request" v={a.agent_company_no ?? ''} />
        <Row k="Offices / territory" u={offices} v={a.agent_territory ?? ''} />
        <Row k="Operational contact" u={u.operational ?? ''} v={g.operational ?? ''} />
        <Row k="Commercial contact" u={u.commercial ?? ''} v={g.commercial ?? ''} />
        <Row k="Accounts contact" u={u.accounts ?? ''} v={g.accounts ?? ''} />
        <Row k="Formal notice email" u={u.notices ?? ''} v={g.notices ?? ''} />
        <Row k="Billing currency" u={`${a.currency} unless stated otherwise`} v={`${a.currency} unless stated otherwise`} />
        <Row k="Standard credit limit" u={a.credit_limit} v={a.credit_limit} />
        <Row k="Payment terms" u={a.payment_terms} v={a.agent_payment_terms ?? a.payment_terms} />
        <Row k="Profit share" u={a.profit_share} v={a.profit_share} />
        <Row k="Insurance minimum" u={a.insurance} v={a.agent_insurance ?? ''} />
        <Row k="Validity" u={validity} v={validity} />
        {a.special_terms ? <Row k="Special terms" u={a.special_terms} v={a.special_terms} /> : null}
      </View>
    </View>
  )
}

/** Execution: UB Freight block pre-filled, agent block from the signing record. */
export function Execution({ a, sigImage }: { a: Agreement; sigImage?: string | null }) {
  const signed = a.status === 'signed'
  const block = (title: string, name: string | null, role: string | null, email: string | null, date: string | null, mark: boolean, img?: string | null) => (
    <View style={s.sigBox}>
      <Text style={s.cap}>{title}</Text>
      <View style={s.sigLine}>{mark && img ? <Image src={img} style={{ height: 46, objectFit: 'contain', objectPosition: 'left' }} /> : <Text style={s.sigName}>{mark ? name ?? '' : ''}</Text>}</View>
      <View style={s.kv}><Text style={s.k}>Name</Text><Text>{name ?? ''}</Text></View>
      <View style={s.kv}><Text style={s.k}>Designation</Text><Text>{role ?? ''}</Text></View>
      <View style={s.kv}><Text style={s.k}>Date</Text><Text>{date ? fmtLong(date) : ''}</Text></View>
      <View style={s.kv}><Text style={s.k}>Email</Text><Text>{email ?? ''}</Text></View>
    </View>
  )
  return (
    <View break>
      <Text style={{ fontSize: 8, letterSpacing: 1.6, color: '#E8742A' }}>EXECUTION</Text>
      <Text style={{ fontSize: 17, color: NAVY, marginTop: 2, marginBottom: 4 }}>Signed by the Parties</Text>
      <Text style={[s.p, { color: '#475467' }]}>The authorised representatives below agree to the terms of this Agency Co-operation Agreement, effective {fmtLong(a.effective_date)} and expiring {fmtLong(a.expiry_date)}.</Text>
      <View style={{ flexDirection: 'row', gap: 14, marginTop: 8 }}>
        {block('FOR UB FREIGHT LTD', a.ubf_signer_name, a.ubf_signer_title, a.ubf_contacts?.notices ?? null, a.ubf_signed_at, !!a.ubf_signed_at)}
        {block(`FOR ${(a.agent_legal_name ?? 'THE AGENT').toUpperCase()}`, a.agent_signature?.name ?? a.signatory_name, a.agent_signature?.title ?? a.signatory_title, a.signatory_email, a.signed_at, signed, sigImage)}
      </View>
      {signed && (
        <View style={{ marginTop: 16, backgroundColor: '#F7F8FA', borderRadius: 5, padding: 12 }}>
          <Text style={s.cap}>ELECTRONIC SIGNATURE RECORD</Text>
          {[
            ['Agreement', `${a.ref} · ${a.kind === 'exclusive' ? 'Exclusive' : 'Non-exclusive'}`],
            ['Signed for UB Freight', `${a.ubf_signer_name ?? ''} · ${stamp(a.ubf_signed_at)}`],
            ['Sent to agent', `${a.signatory_email ?? ''} · ${stamp(a.sent_at)}`],
            ['Opened by agent', stamp(a.viewed_at)],
            ['Signed by agent', `${a.agent_signature?.name ?? a.signatory_name ?? ''} · ${stamp(a.signed_at)} · ${a.agent_signature?.method === 'drawn' ? 'drawn' : 'typed'} signature`],
          ].map(([k, v]) => (
            <View key={k} style={s.kv}><Text style={{ width: 110, color: '#5B6474' }}>{k}</Text><Text style={{ flex: 1 }}>{v}</Text></View>
          ))}
        </View>
      )}
      <Text style={{ fontSize: 7.5, color: '#8A93A6', marginTop: 14 }}>This Agreement may be executed in counterparts and by electronic signature under clause 18.5.</Text>
    </View>
  )
}
