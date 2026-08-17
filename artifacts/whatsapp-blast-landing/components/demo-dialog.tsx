'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';

type Interest = 'ai' | 'waba' | 'digital' | 'other';

const labels: Record<Interest, string> = {
  ai: 'Agentic AI Assistant',
  waba: 'WABA Messaging',
  digital: 'Pulsa & Voucher',
  other: 'Konsultasi umum',
};

export function DemoDialog({
  open,
  onClose,
  defaultInterest = 'ai',
}: {
  open: boolean;
  onClose: () => void;
  defaultInterest?: Interest;
}) {
  const [sent, setSent] = useState(false);
  const [interest, setInterest] = useState<Interest>(defaultInterest);

  if (!open) return null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          setSent(false);
          onClose();
        }
      }}
    >
      <div className="contact-modal" role="dialog" aria-modal="true" aria-labelledby="demo-title">
        <button
          type="button"
          className="modal-close"
          onClick={() => {
            setSent(false);
            onClose();
          }}
          aria-label="Tutup"
        >
          <X size={16} />
        </button>

        {sent ? (
          <div className="form-success">
            <span className="success-icon">
              <Check size={24} strokeWidth={3} />
            </span>
            <h3>Demo terjadwal.</h3>
            <p>Tim Ora Repot akan menghubungi Anda untuk sesi demo {labels[interest]}.</p>
            <button
              type="button"
              className="form-submit"
              onClick={() => {
                setSent(false);
                onClose();
              }}
            >
              Selesai
            </button>
          </div>
        ) : (
          <>
            <h2 id="demo-title">Coba sekarang</h2>
            <p className="modal-intro">
              Cocok untuk merchant yang ingin melihat AI Assistant Ora Repot beraksi di WhatsApp.
            </p>
            <form className="contact-form" onSubmit={onSubmit}>
              <label className="form-label">
                Minat produk
                <select
                  className="form-input"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value as Interest)}
                >
                  <option value="ai">Agentic AI Assistant</option>
                  <option value="waba">WABA Messaging</option>
                  <option value="digital">Pulsa & Voucher</option>
                  <option value="other">Lainnya</option>
                </select>
              </label>
              <label className="form-label">
                Nama
                <input required className="form-input" placeholder="Nama Anda" name="name" />
              </label>
              <label className="form-label">
                WhatsApp
                <input
                  required
                  type="tel"
                  className="form-input"
                  placeholder="08xx xxxx xxxx"
                  name="phone"
                />
              </label>
              <label className="form-label">
                Nama bisnis
                <input required className="form-input" placeholder="Nama toko / bisnis" name="business" />
              </label>
              <button type="submit" className="form-submit">
                Kirim permintaan demo <ArrowRight size={15} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
