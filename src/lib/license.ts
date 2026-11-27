import { LicenseState } from '../types';

const LICENSE_STORAGE_KEY = 'auvori_license_v1';
const DEVICE_ID_KEY = 'auvori_device_id_v1';

/**
 * Saat `npm run dev`, semua fitur Pro otomatis terbuka untuk pengujian lokal.
 * Build produksi (`npm run build` / `npm run preview`) tetap memakai alur lisensi normal.
 */
const DEV_UNLOCKED = import.meta.env.DEV;

export const LYNK_CHECKOUT_URL =
  import.meta.env.VITE_LYNK_CHECKOUT_URL || 'https://lynk.id/auvori/pro-lifetime';

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function loadSavedLicense(): LicenseState {
  if (DEV_UNLOCKED) {
    return {
      isPro: true,
      email: 'dev@localhost',
      plan: 'Pro Lifetime (Dev Unlock)',
      activatedAt: new Date().toISOString()
    };
  }

  try {
    const raw = localStorage.getItem(LICENSE_STORAGE_KEY);
    if (!raw) return { isPro: false };
    const parsed = JSON.parse(raw) as LicenseState;
    return parsed?.isPro ? parsed : { isPro: false };
  } catch {
    return { isPro: false };
  }
}

export function saveLicense(state: LicenseState): void {
  localStorage.setItem(LICENSE_STORAGE_KEY, JSON.stringify(state));
}

export function clearLicense(): void {
  localStorage.removeItem(LICENSE_STORAGE_KEY);
}

export interface VerifyLicenseResult {
  ok: boolean;
  message: string;
  license?: LicenseState;
}

/**
 * Verifies buyer email or Lynk.id license code against Cloudflare Pages Function (/api/license/verify).
 */
export async function verifyLicenseWithServer(identifier: string): Promise<VerifyLicenseResult> {
  const clean = identifier.trim();
  if (!clean) {
    return { ok: false, message: 'Masukkan email pembelian Lynk.id atau kode akses kamu.' };
  }

  // Built-in demo key so developer can test Pro flow locally before connecting D1
  if (clean.toUpperCase() === 'AUVORI-DEMO') {
    const demoLicense: LicenseState = {
      isPro: true,
      email: 'demo@auvori.app',
      plan: 'Pro Lifetime (Demo)',
      activatedAt: new Date().toISOString()
    };
    saveLicense(demoLicense);
    return { ok: true, message: 'Mode Demo Pro aktif!', license: demoLicense };
  }

  try {
    const res = await fetch('/api/license/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: clean,
        deviceId: getOrCreateDeviceId()
      })
    });

    const data = (await res.json()) as {
      valid?: boolean;
      error?: string;
      email?: string;
      plan?: string;
    };

    if (!res.ok || !data.valid) {
      return {
        ok: false,
        message:
          data.error ||
          'Email atau kode belum terdaftar. Pastikan kamu memakai email yang sama saat checkout di Lynk.id.'
      };
    }

    const license: LicenseState = {
      isPro: true,
      email: data.email || clean,
      plan: data.plan || 'Auvori Pro Lifetime',
      activatedAt: new Date().toISOString()
    };
    saveLicense(license);

    return { ok: true, message: 'Akses Auvori Pro berhasil diaktifkan!', license };
  } catch {
    return {
      ok: false,
      message:
        'Gagal terhubung ke server verifikasi. Jika sedang mencoba secara lokal, gunakan kode AUVORI-DEMO.'
    };
  }
}
