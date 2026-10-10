import QRCode from "qrcode";

/** SVG QR — Worker-safe (no canvas). */
export async function buildMenuQrSvg(
  url: string,
  size = 512
): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0a0a0b",
      light: "#ffffff",
    },
  });
}
