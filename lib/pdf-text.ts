import { PDFParse } from "pdf-parse";

export type PdfHyperlink = {
  text: string;
  url: string;
};

export type PdfExtractContent = {
  /** Plain text plus markdown/appendix hyperlinks for the AI + heuristics. */
  text: string;
  links: PdfHyperlink[];
};

/** True when buffer starts with the PDF magic header (`%PDF`). */
export function isPdfMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 // F
  );
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/[.,;)\]]+$/, "");
}

function dedupeLinks(links: PdfHyperlink[]): PdfHyperlink[] {
  const seen = new Set<string>();
  const out: PdfHyperlink[] = [];
  for (const link of links) {
    const url = normalizeUrl(link.url);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: link.text.trim(), url });
  }
  return out;
}

function linksFromMarkdown(text: string): PdfHyperlink[] {
  const out: PdfHyperlink[] = [];
  for (const match of text.matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi)) {
    out.push({ text: match[1] ?? "", url: match[2] ?? "" });
  }
  return out;
}

/**
 * Extract resume text and embedded hyperlinks from a PDF buffer (Node only).
 * Hyperlinks on label text like "LinkedIn" / "GitHub" are recovered via
 * parseHyperlinks + page link annotations.
 */
export async function extractPdfContent(
  buffer: Buffer,
): Promise<PdfExtractContent> {
  if (!isPdfMagicBytes(buffer)) {
    throw new Error("Not a PDF file");
  }

  const parser = new PDFParse({ data: buffer });
  try {
    const textResult = await parser.getText({ parseHyperlinks: true });
    const infoResult = await parser.getInfo({ parsePageInfo: true });

    const annotationLinks = (infoResult.pages ?? []).flatMap((page) =>
      (page.links ?? []).map((link) => ({
        text: link.text ?? "",
        url: link.url ?? "",
      })),
    );

    const rawText = textResult.text ?? "";
    const links = dedupeLinks([
      ...annotationLinks,
      ...linksFromMarkdown(rawText),
    ]);

    const appendix =
      links.length > 0
        ? `\n\nEXTRACTED_HYPERLINKS:\n${links
            .map((link) => `- ${link.text || "link"}: ${link.url}`)
            .join("\n")}`
        : "";

    return {
      text: `${rawText}${appendix}`,
      links,
    };
  } finally {
    await parser.destroy();
  }
}

/** @deprecated Prefer extractPdfContent when hyperlinks matter. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const { text } = await extractPdfContent(buffer);
  return text;
}
