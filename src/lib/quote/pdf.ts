import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  quoteSubtotal,
  type QuoteOrder,
} from "@/lib/quote/types";

function money(n: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

function wrapText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

/**
 * Generate a simple professional quote PDF with pdf-lib (Worker-safe).
 */
export async function buildQuotePdf(order: QuoteOrder): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const width = page.getWidth();
  let y = page.getHeight() - margin;

  const ink = rgb(0.08, 0.08, 0.1);
  const muted = rgb(0.4, 0.4, 0.45);
  const line = rgb(0.85, 0.85, 0.88);
  const accent = rgb(0.06, 0.46, 0.43);

  page.drawText("JIY.APP", {
    x: margin,
    y,
    size: 11,
    font: fontBold,
    color: accent,
  });
  page.drawText("QUOTE", {
    x: width - margin - fontBold.widthOfTextAtSize("QUOTE", 18),
    y: y - 4,
    size: 18,
    font: fontBold,
    color: ink,
  });
  y -= 28;

  page.drawText(order.title, {
    x: margin,
    y,
    size: 14,
    font: fontBold,
    color: ink,
  });
  y -= 16;
  page.drawText(`Quote ID: ${order.id}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: muted,
  });
  y -= 12;
  page.drawText(`Date: ${order.createdAt.slice(0, 10)}`, {
    x: margin,
    y,
    size: 9,
    font,
    color: muted,
  });
  if (order.validUntil) {
    y -= 12;
    page.drawText(`Valid until: ${order.validUntil}`, {
      x: margin,
      y,
      size: 9,
      font,
      color: muted,
    });
  }
  y -= 24;

  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: line,
  });
  y -= 28;

  const colW = (width - margin * 2 - 24) / 2;
  page.drawText("From", {
    x: margin,
    y,
    size: 9,
    font: fontBold,
    color: muted,
  });
  page.drawText("Bill to", {
    x: margin + colW + 24,
    y,
    size: 9,
    font: fontBold,
    color: muted,
  });
  y -= 14;

  const fromLines = [
    order.issuerName,
    order.issuerCompany,
    order.issuerEmail,
    order.issuerAddress,
    order.issuerVat ? `VAT: ${order.issuerVat}` : null,
  ].filter(Boolean) as string[];

  const toLines = [
    order.clientName,
    order.clientCompany,
    order.clientEmail,
    order.clientAddress,
  ].filter(Boolean) as string[];

  const blockStart = y;
  let yFrom = blockStart;
  for (const t of fromLines) {
    for (const wl of wrapText(t, colW, font, 10)) {
      page.drawText(wl, { x: margin, y: yFrom, size: 10, font, color: ink });
      yFrom -= 13;
    }
  }
  let yTo = blockStart;
  for (const t of toLines) {
    for (const wl of wrapText(t, colW, font, 10)) {
      page.drawText(wl, {
        x: margin + colW + 24,
        y: yTo,
        size: 10,
        font,
        color: ink,
      });
      yTo -= 13;
    }
  }
  y = Math.min(yFrom, yTo) - 20;

  // Table header
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: width - margin * 2,
    height: 22,
    color: rgb(0.95, 0.96, 0.96),
  });
  const descX = margin + 8;
  const qtyX = width - margin - 220;
  const priceX = width - margin - 140;
  const totalX = width - margin - 60;
  page.drawText("Description", {
    x: descX,
    y: y + 2,
    size: 9,
    font: fontBold,
    color: muted,
  });
  page.drawText("Qty", {
    x: qtyX,
    y: y + 2,
    size: 9,
    font: fontBold,
    color: muted,
  });
  page.drawText("Price", {
    x: priceX,
    y: y + 2,
    size: 9,
    font: fontBold,
    color: muted,
  });
  page.drawText("Total", {
    x: totalX,
    y: y + 2,
    size: 9,
    font: fontBold,
    color: muted,
  });
  y -= 26;

  for (const item of order.lineItems) {
    const lineTotal = item.quantity * item.unitPrice;
    const descLines = wrapText(item.description, qtyX - descX - 12, font, 10);
    for (let i = 0; i < descLines.length; i++) {
      page.drawText(descLines[i], {
        x: descX,
        y,
        size: 10,
        font,
        color: ink,
      });
      if (i === 0) {
        page.drawText(String(item.quantity), {
          x: qtyX,
          y,
          size: 10,
          font,
          color: ink,
        });
        page.drawText(money(item.unitPrice), {
          x: priceX,
          y,
          size: 10,
          font,
          color: ink,
        });
        page.drawText(money(lineTotal), {
          x: totalX,
          y,
          size: 10,
          font,
          color: ink,
        });
      }
      y -= 14;
    }
    y -= 6;
    if (y < 120) break;
  }

  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: line,
  });
  y -= 22;

  const subtotal = quoteSubtotal(order.lineItems);
  page.drawText("Subtotal", {
    x: priceX,
    y,
    size: 10,
    font,
    color: muted,
  });
  page.drawText(money(subtotal), {
    x: totalX,
    y,
    size: 11,
    font: fontBold,
    color: ink,
  });
  y -= 18;
  page.drawText("Total", {
    x: priceX,
    y,
    size: 11,
    font: fontBold,
    color: ink,
  });
  page.drawText(money(subtotal), {
    x: totalX,
    y,
    size: 12,
    font: fontBold,
    color: accent,
  });

  if (order.notes) {
    y -= 36;
    page.drawText("Notes", {
      x: margin,
      y,
      size: 9,
      font: fontBold,
      color: muted,
    });
    y -= 14;
    for (const wl of wrapText(order.notes, width - margin * 2, font, 9)) {
      page.drawText(wl, { x: margin, y, size: 9, font, color: ink });
      y -= 12;
      if (y < 60) break;
    }
  }

  page.drawText("Generated by JIY Quote — payment unlocks download only. Not e-sign.", {
    x: margin,
    y: 36,
    size: 8,
    font,
    color: muted,
  });

  return doc.save();
}
