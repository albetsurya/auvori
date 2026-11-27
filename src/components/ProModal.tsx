import React, { useEffect, useState } from 'react';
import { CheckCircle2, Crown, ExternalLink, KeyRound, LogOut, Sparkles } from 'lucide-react';
import { LicenseState } from '../types';
import { clearLicense, LYNK_CHECKOUT_URL, verifyLicenseWithServer } from '../lib/license';
import { ModalSheet } from './ui/ModalSheet';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface ProModalProps {
  isOpen: boolean;
  initialTab?: 'buy' | 'activate';
  prefillIdentifier?: string;
  license: LicenseState;
  onClose: () => void;
  onLicenseChange: (next: LicenseState) => void;
}

export const ProModal: React.FC<ProModalProps> = ({
  isOpen,
  initialTab = 'buy',
  prefillIdentifier = '',
  license,
  onClose,
  onLicenseChange
}) => {
  const [tab, setTab] = useState<'buy' | 'activate'>(initialTab);
  const [identifier, setIdentifier] = useState(prefillIdentifier);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (prefillIdentifier) setIdentifier(prefillIdentifier);
  }, [prefillIdentifier]);

  if (!isOpen) return null;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    const res = await verifyLicenseWithServer(identifier);
    setLoading(false);

    if (res.ok && res.license) {
      setFeedback({ type: 'ok', text: res.message });
      onLicenseChange(res.license);
      setTimeout(() => {
        onClose();
      }, 900);
    } else {
      setFeedback({ type: 'err', text: res.message });
    }
  };

  const handleLogout = () => {
    clearLicense();
    onLicenseChange({ isPro: false });
    setFeedback(null);
  };

  return (
    <ModalSheet
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      title="Auvori Pro"
      subtitle="Sekali bayar via Lynk.id · Tanpa langganan"
    >
      {license.isPro ? (
        <div className="space-y-4">
          <div className="p-4 rounded-[12px] bg-success/10 border border-success/30 space-y-1.5">
            <div className="flex items-center gap-2 text-success font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.8} />
              Status Auvori Pro Aktif
            </div>
            <p className="text-xs text-textSecondary">
              Email: <span className="font-semibold text-textPrimary">{license.email}</span>
            </p>
            <p className="text-[11px] text-textSecondary">Paket: {license.plan || 'Pro Lifetime'}</p>
          </div>

          <Button variant="secondary" fullWidth onClick={handleLogout}>
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            Nonaktifkan di Perangkat Ini
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 bg-surfaceSecondary p-1 rounded-[8px] border border-border">
            <button
              onClick={() => setTab('buy')}
              className={`min-h-[40px] py-2 rounded-[6px] text-xs font-semibold transition duration-fast ${
                tab === 'buy'
                  ? 'bg-primary text-primaryText'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Beli via Lynk.id
            </button>
            <button
              onClick={() => setTab('activate')}
              className={`min-h-[40px] py-2 rounded-[6px] text-xs font-semibold transition duration-fast ${
                tab === 'activate'
                  ? 'bg-primary text-primaryText'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Sudah Beli? Aktifkan
            </button>
          </div>

          {tab === 'buy' ? (
            <div className="space-y-4">
              <ul className="space-y-2.5 text-xs text-textPrimary bg-surfaceSecondary p-4 rounded-[12px] border border-border">
                <li className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" strokeWidth={1.8} />
                  <span>Buka seluruh koleksi Pro (Portrait, Korean, Café, Film, Night)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" strokeWidth={1.8} />
                  <span>Simpan foto resolusi penuh (HD asli) tanpa watermark</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" strokeWidth={1.8} />
                  <span>Ekspor Kartu Before/After editorial siap Threads &amp; IG</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-primary shrink-0" strokeWidth={1.8} />
                  <span>Bayar praktis pakai QRIS, GoPay, DANA, OVO di Lynk.id</span>
                </li>
              </ul>

              <a
                href={LYNK_CHECKOUT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] h-12 px-5 rounded-[10px] bg-primary hover:bg-primaryHover text-primaryText font-medium text-sm flex items-center justify-center gap-2 shadow-card transition duration-fast"
              >
                <Crown className="w-4 h-4" strokeWidth={1.8} />
                <span>Checkout Pro di Lynk.id</span>
                <ExternalLink className="w-4 h-4" strokeWidth={1.8} />
              </a>

              <p className="text-[11px] text-center text-textSecondary">
                Setelah pembayaran sukses, klik tab <strong>Sudah Beli? Aktifkan</strong> dan
                masukkan email Lynk.id kamu.
              </p>
            </div>
          ) : (
            <form onSubmit={handleActivate} className="space-y-3.5">
              <Input
                label="Email Pembelian Lynk.id atau Kode Akses"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="contoh: kamu@gmail.com atau AUV-XXXX"
                leftIcon={<KeyRound className="w-4 h-4" strokeWidth={1.8} />}
                error={feedback?.type === 'err' ? feedback.text : undefined}
                required
              />

              {feedback?.type === 'ok' && (
                <div className="p-3 rounded-[10px] text-xs font-medium bg-success/15 text-success border border-success/30">
                  {feedback.text}
                </div>
              )}

              <Button type="submit" variant="primary" fullWidth loading={loading}>
                {loading ? 'Memverifikasi...' : 'Aktifkan Akses Pro'}
              </Button>

              <p className="text-[11px] text-center text-textSecondary">
                Tips pengujian lokal: ketik{' '}
                <code className="text-textPrimary font-semibold">AUVORI-DEMO</code> untuk mencoba
                mode Pro.
              </p>
            </form>
          )}
        </div>
      )}
    </ModalSheet>
  );
};
