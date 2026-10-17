// src/features/sli/SliPdf.tsx
// One-page A4 copy of the signed SLI. Rendered in the browser after signing, emailed by sli-finish.
import React from "react";
import { Document, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { registerConsignmentPdfFonts } from "@/features/tms/pdf/consignmentPdfShared";

export type SliPdfData = {
  footer?: string;
  ref: string; customerRef?: string | null; route: string; flight: string; cutoff: string; incoterm: string;
  shipper: string[]; consignee: string[];
  pieces: string; weight: string; cbm: string; chargeable: string; goods: string; special: string;
  cartage: string[]; answers: [string, string][]; batteries: string; documents: string[];
  signedName: string; signature: string; signedAt: string; declaration: string;
};

const NAVY = "#0A2472";
const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 30, paddingHorizontal: 34, fontFamily: "General Sans", fontSize: 8.5, color: "#101828" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1.5, borderColor: NAVY, paddingBottom: 8 },
  logo: { width: 86, height: 42, objectFit: "contain" },
  title: { fontSize: 14, fontWeight: 700, color: NAVY, textAlign: "right" },
  sub: { fontSize: 8, color: "#475467", textAlign: "right", marginTop: 2 },
  strip: { flexDirection: "row", backgroundColor: "#F5F7FC", borderRadius: 4, marginTop: 10 },
  cell: { flex: 1, paddingVertical: 6, paddingHorizontal: 8 },
  k: { fontSize: 6.8, color: "#667085", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 1.5 },
  v: { fontSize: 9, fontWeight: 600 },
  row: { flexDirection: "row", marginTop: 10, gap: 10 },
  box: { borderWidth: 0.75, borderColor: "#E4E7EC", borderRadius: 4, padding: 8 },
  col: { flexGrow: 1, flexBasis: 0 },
  h: { fontSize: 8, fontWeight: 700, color: NAVY, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  line: { lineHeight: 1.35 },
  li: { marginBottom: 1.5 },
  qa: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#F2F4F7", paddingVertical: 2.5 },
  q: { flex: 1, color: "#475467" },
  a: { width: 120, textAlign: "right", fontWeight: 600 },
  decl: { marginTop: 10, fontSize: 7.2, color: "#475467", lineHeight: 1.4 },
  sign: { flexDirection: "row", marginTop: 10, gap: 10, alignItems: "flex-end" },
  sig: { fontSize: 16, color: NAVY, borderBottomWidth: 0.75, borderColor: "#98A2B3", paddingBottom: 2 },
  foot: { position: "absolute", bottom: 16, left: 34, right: 34, flexDirection: "row", justifyContent: "space-between", fontSize: 6.8, color: "#98A2B3" },
});

const Cell = ({ k, v }: { k: string; v: string }) => (
  <View style={s.cell}><Text style={s.k}>{k}</Text><Text style={s.v}>{v || "—"}</Text></View>
);
const Lines = ({ title, lines }: { title: string; lines: string[] }) => (
  <View style={[s.box, s.col]}><Text style={s.h}>{title}</Text>{lines.filter(Boolean).map((l, i) => <Text key={i} style={s.li}>{l}</Text>)}</View>
);

export function SliDoc({ d }: { d: SliPdfData }) {
  return (
    <Document title={`SLI ${d.ref}`} author="UB Freight Limited">
      <Page size="A4" style={s.page}>
        <View style={s.head}>
          <Image src="/ub-freight-logo-ink.png" style={s.logo} />
          <View>
            <Text style={s.title}>Shipper's Letter of Instruction</Text>
            <Text style={s.sub}>Booking {d.ref}{d.customerRef ? `  ·  Ref ${d.customerRef}` : ""}  ·  Signed {d.signedAt}</Text>
          </View>
        </View>

        <View style={s.strip}>
          <Cell k="Route" v={d.route} /><Cell k="Flight" v={d.flight} /><Cell k="Cut-off" v={d.cutoff} /><Cell k="Incoterm" v={d.incoterm} />
        </View>

        <View style={s.row}>
          <Lines title="Shipper" lines={d.shipper} />
          <Lines title="Consignee" lines={d.consignee} />
          <Lines title="Pickup / drop-off" lines={d.cartage} />
        </View>

        <View style={[s.strip, { marginTop: 10 }]}>
          <Cell k="Pieces" v={d.pieces} /><Cell k="Gross weight" v={d.weight} /><Cell k="Volume" v={d.cbm} /><Cell k="Chargeable" v={d.chargeable} />
        </View>
        <View style={s.row}>
          <View style={[s.box, { flexGrow: 2, flexBasis: 0 }]}>
            <Text style={s.h}>Goods</Text><Text style={s.line}>{d.goods || "—"}</Text>
            {d.special ? <><Text style={[s.h, { marginTop: 6 }]}>Special instructions</Text><Text style={s.line}>{d.special}</Text></> : null}
          </View>
          <Lines title="Documents attached" lines={d.documents.length ? d.documents : ["None"]} />
        </View>

        <View style={[s.box, { marginTop: 10 }]}>
          <Text style={s.h}>Declarations</Text>
          {d.answers.map(([q, a]) => <View key={q} style={s.qa}><Text style={s.q}>{q}</Text><Text style={s.a}>{a}</Text></View>)}
          <View style={[s.qa, { borderBottomWidth: 0 }]}><Text style={s.q}>Batteries</Text><Text style={s.a}>{d.batteries}</Text></View>
        </View>

        <Text style={s.decl}>{d.declaration}</Text>
        <View style={s.sign}>
          <View style={{ flex: 1 }}><Text style={s.k}>Signature</Text><Text style={s.sig}>{d.signature}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.k}>Name</Text><Text style={s.v}>{d.signedName}</Text></View>
          <View style={{ width: 120 }}><Text style={s.k}>Date</Text><Text style={s.v}>{d.signedAt}</Text></View>
        </View>

        <View style={s.foot} fixed>
          <Text>{d.footer ?? 'UB Freight Limited · 173 Montgomerie Road, Airport Oaks, Auckland 2022 · +64 9 966 3850 · exportair.nz@ubfreight.com'}</Text>
          <Text>{d.ref}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderSliPdf(d: SliPdfData): Promise<Blob> {
  registerConsignmentPdfFonts();
  return pdf(<SliDoc d={d} />).toBlob();
}
