import QRCode from "qrcode";

// GET /api/tickets/[code]/qr
//
// Returns a PNG of the QR code that encodes `code`. Public on
// purpose — the code itself is the auth (8 bytes of randomness,
// ~10^19 keyspace, unguessable). No DB lookup; we just render
// whatever code is in the URL, so this is a pure transform.
//
// Email templates embed this URL in <img src="..."> rather than
// inline data: URIs because Gmail / Outlook / Apple Mail
// inconsistently block large data URIs.

export const dynamic = "force-static";
export const revalidate = 31536000; // 1 year — same QR for a given code

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> }
) {
  const { code } = await context.params;

  // Defensive shape check — codes are base64url 8-byte randoms
  // (~11 chars). Anything wildly off-shape is rejected to keep
  // this endpoint cheap and uninteresting to abuse.
  if (!code || code.length < 4 || code.length > 64) {
    return new Response("Invalid code", { status: 400 });
  }

  try {
    const buffer = await QRCode.toBuffer(code, {
      width: 320,
      margin: 1,
      color: { dark: "#0d0b08", light: "#ffffff" },
    });
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control":
          "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return new Response("Failed to generate QR", { status: 500 });
  }
}
