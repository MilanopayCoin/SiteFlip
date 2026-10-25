import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

async function qrPngBytes(url: string, size = 220): Promise<Uint8Array> {
  const dataUrl = await QRCode.toDataURL(url, {
    type: "image/png",
    width: size,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0a0b", light: "#ffffff" },
  });
  const b64 = dataUrl.split(",")[1] || "";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * A4 print sheet: up to 6 table QR cards (2×3) ready for print shop.
 */
export async function buildTablePrintPackPdf(input: {
  venueName: string;
  slug: string;
  baseUrl: string;
  tableCount: number;
}): Promise<Uint8Array> {
  const count = Math.min(40, Math.max(1, Math.floor(input.tableCount) || 6));
  const perPage = 6;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 36;
  const gapX = 16;
  const gapY = 18;
  const cols = 2;
  const rows = 3;
  const cardW = (pageW - margin * 2 - gapX) / cols;
  const cardH = (pageH - margin * 2 - gapY * 2) / rows;

  const ink = rgb(0.08, 0.08, 0.1);
  const muted = rgb(0.45, 0.45, 0.48);
  const line = rgb(0.82, 0.82, 0.85);

  for (let start = 0; start < count; start += perPage) {
    const page = doc.addPage([pageW, pageH]);
    const slice = Array.from(
      { length: Math.min(perPage, count - start) },
      (_, i) => start + i + 1
    );

    for (let i = 0; i < slice.length; i++) {
      const tableNo = slice[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = margin + col * (cardW + gapX);
      const y = pageH - margin - (row + 1) * cardH - row * gapY;

      page.drawRectangle({
        x,
        y,
        width: cardW,
        height: cardH,
        borderColor: line,
        borderWidth: 1,
      });

      const title = input.venueName.slice(0, 42);
      page.drawText(title, {
        x: x + 14,
        y: y + cardH - 28,
        size: 12,
        font: fontBold,
        color: ink,
      });
      page.drawText(`Masa ${tableNo}`, {
        x: x + 14,
        y: y + cardH - 46,
        size: 16,
        font: fontBold,
        color: ink,
      });
      page.drawText("Menuyu okutun", {
        x: x + 14,
        y: y + cardH - 62,
        size: 9,
        font,
        color: muted,
      });

      const target = `${input.baseUrl.replace(/\/$/, "")}/m/${input.slug}?masa=${tableNo}`;
      const png = await qrPngBytes(target, 240);
      const img = await doc.embedPng(png);
      const qrSize = 132;
      const qrX = x + (cardW - qrSize) / 2;
      const qrY = y + 36;
      page.drawImage(img, { x: qrX, y: qrY, width: qrSize, height: qrSize });

      const short = `/m/${input.slug}?masa=${tableNo}`;
      const shortW = font.widthOfTextAtSize(short, 7);
      page.drawText(short, {
        x: x + (cardW - shortW) / 2,
        y: y + 18,
        size: 7,
        font,
        color: muted,
      });
    }

    page.drawText("JIY Menu — print pack", {
      x: margin,
      y: 16,
      size: 8,
      font,
      color: muted,
    });
  }

  return doc.save();
}
