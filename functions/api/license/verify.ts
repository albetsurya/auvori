interface Env {
  DB: D1Database;
}

interface LicenseRow {
  id: number;
  email: string;
  license_code: string;
  plan: string;
  status: string;
  max_devices: number;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = (await request.json()) as { identifier?: string; deviceId?: string };
    const identifier = (body.identifier || '').trim();
    const deviceId = (body.deviceId || 'unknown-device').trim();

    if (!identifier) {
      return Response.json(
        { valid: false, error: 'Masukkan email pembelian Lynk.id atau kode akses.' },
        { status: 400 }
      );
    }

    const license = await env.DB.prepare(
      `SELECT id, email, license_code, plan, status, max_devices
       FROM licenses
       WHERE status = 'active'
         AND (LOWER(email) = LOWER(?) OR UPPER(license_code) = UPPER(?) OR UPPER(ref_id) = UPPER(?))
       LIMIT 1`
    )
      .bind(identifier, identifier, identifier)
      .first<LicenseRow>();

    if (!license) {
      return Response.json(
        {
          valid: false,
          error:
            'Email atau kode belum terdaftar. Pastikan kamu memakai email yang sama saat checkout di Lynk.id.'
        },
        { status: 404 }
      );
    }

    // Cek apakah perangkat ini sudah pernah terdaftar
    const existingDevice = await env.DB.prepare(
      'SELECT id FROM device_activations WHERE license_id = ? AND device_id = ?'
    )
      .bind(license.id, deviceId)
      .first<{ id: number }>();

    if (existingDevice) {
      await env.DB.prepare(
        "UPDATE device_activations SET last_seen_at = datetime('now') WHERE id = ?"
      )
        .bind(existingDevice.id)
        .run();
    } else {
      const countRow = await env.DB.prepare(
        'SELECT COUNT(*) as total FROM device_activations WHERE license_id = ?'
      )
        .bind(license.id)
        .first<{ total: number }>();

      const used = Number(countRow?.total || 0);
      if (used >= license.max_devices) {
        return Response.json(
          {
            valid: false,
            error: `Lisensi ini sudah mencapai batas maksimal ${license.max_devices} perangkat.`
          },
          { status: 403 }
        );
      }

      await env.DB.prepare(
        'INSERT INTO device_activations (license_id, device_id) VALUES (?, ?)'
      )
        .bind(license.id, deviceId)
        .run();
    }

    return Response.json({
      valid: true,
      email: license.email,
      plan: license.plan
    });
  } catch (err) {
    return Response.json(
      { valid: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
};
