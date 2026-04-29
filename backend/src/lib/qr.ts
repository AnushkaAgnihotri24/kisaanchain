import QRCode from "qrcode";

export async function generateQrDataUrl(verificationUrl: string) {
  return QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 360
  });
}
