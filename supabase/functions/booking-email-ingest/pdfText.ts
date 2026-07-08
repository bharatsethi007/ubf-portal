import { extractText, getDocumentProxy } from "npm:unpdf@0.12.1";

export type PdfExtractResult = { text: string | null; note?: string };

/** Extract text from a PDF buffer. Returns null text for scanned/empty PDFs (no OCR). */
export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtractResult> {
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const cleaned = (text ?? "").replace(/\s+/g, " ").trim();
    if (!cleaned) {
      return { text: null, note: `PDF has ${totalPages} page(s) but no extractable text (likely scanned)` };
    }
    return { text: cleaned };
  } catch (e) {
    return { text: null, note: e instanceof Error ? e.message : "PDF parse failed" };
  }
}
