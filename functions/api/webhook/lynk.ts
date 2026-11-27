interface Env {
  DB: D1Database;
  LYNK_MERCHANT_KEY?: string;
  PRO_PRODUCT_KEYWORD?: string;
}

function generateLicenseCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `AUV-${part(4)}-${part(4)}`;
}

async function verifyHmacSha256(
  rawBody: string,
  secret: string,
  receivedSig: string
): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const hexSig = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const cleanReceived = receivedSig.replace(/^sha256=/i, '').trim().toLowerCase();
  return hexSig === cleanReceived;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const rawBody = await request.text();

    // 1. Verifikasi Merchant Key Signature (SHA-256 HMAC) jika LYNK_MERCHANT_KEY disetel
    if (env.LYNK_MERCHANT_KEY) {
      const signature =
        request.headers.get('x-lynk-signature') ||
        request.headers.get('x-webhook-signature') ||
        request.headers.get('x-signature') ||
        '';

      if (!signature) {
        return Response.json({ ok: false, error: 'Missing webhook signature' }, { status: 401 });
      }

      const valid = await verifyHmacSha256(rawBody, env.LYNK_MERCHANT_KEY, signature);
      if (!valid) {
        return Response.json({ ok: false, error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody) as Record<string, any>;
    const msg = payload?.data?.message_data || payload?.data || payload;

    const eventType = String(payload?.event || msg?.event || 'order.paid');
    const refId = String(msg?.refId || msg?.ref_id || msg?.order_id || `LYNK-${Date.now()}`);
    const customer = msg?.customer || {};
    const email = String(customer?.email || msg?.email || '').trim().toLowerCase();
    const buyerName = String(customer?.name || msg?.name || '').trim();

    // Log raw webhook untuk audit / debugging
    await env.DB.prepare(
      'INSERT INTO webhook_logs (ref_id, event_type, payload) VALUES (?, ?, ?)'
    )
      .bind(refId, eventType, rawBody.slice(0, 4000))
      .run();

    if (!email) {
      return Response.json({ ok: false, error: 'Email pembeli tidak ditemukan di payload' }, { status: 400 });
    }

    // 2. Filter produk jika akun Lynk.id menjual lebih dari 1 produk
    const keyword = (env.PRO_PRODUCT_KEYWORD || '').trim().toLowerCase();
    if (keyword) {
      const itemsText = JSON.stringify(msg?.items || msg?.product_name || msg?.title || '').toLowerCase();
      if (itemsText && !itemsText.includes(keyword)) {
        return Response.json({
          ok: true,
          ignored: true,
          reason: `Produk bukan target keyword "${keyword}"`
        });
      }
    }

    // 3. Cek apakah order sudah pernah diproses (idempotent)
    const existing = await env.DB.prepare(
      'SELECT license_code FROM licenses WHERE ref_id = ? OR LOWER(email) = ? LIMIT 1'
    )
      .bind(refId, email)
      .first<{ license_code: string }>();

    if (existing) {
      return Response.json({
        ok: true,
        alreadyActive: true,
        email,
        licenseCode: existing.license_code
      });
    }

    // 4. Terbitkan lisensi Pro baru di Cloudflare D1
    const licenseCode = generateLicenseCode();
    await env.DB.prepare(
      `INSERT INTO licenses (email, license_code, ref_id, buyer_name, plan, status, max_devices)
       VALUES (?, ?, ?, ?, 'Auvori Pro Lifetime', 'active', 3)`
    )
      .bind(email, licenseCode, refId, buyerName)
      .run();

    return Response.json({
      ok: true,
      email,
      licenseCode,
      refId
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Webhook error' },
      { status: 500 }
    );
  }
};
