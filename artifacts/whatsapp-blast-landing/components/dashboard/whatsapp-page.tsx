'use client';

import { useEffect, useState } from 'react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useT } from '@/components/i18n/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { connectWaba, fetchWaba, type WabaRow } from '@/lib/orarepot-api';

export function WhatsappPage() {
  const t = useT();
  const [rows, setRows] = useState<WabaRow[]>([]);
  const [phoneId, setPhoneId] = useState('1241209412413230');
  const [wabaId, setWabaId] = useState('1583214010076432');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');

  function reload() {
    fetchWaba()
      .then(setRows)
      .catch(() => setRows([]));
  }

  useEffect(() => {
    reload();
  }, []);

  async function onConnect() {
    setSaving(true);
    setNote('');
    try {
      await connectWaba({
        displayName: 'Ora Repot',
        metaWabaId: wabaId.trim(),
        metaPhoneId: phoneId.trim(),
      });
      setNote('WABA tersimpan.');
      reload();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Gagal simpan WABA');
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell title={t('menu.whatsapp')} subtitle={t('page.whatsapp')}>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Nomor terhubung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground m-0">Belum ada WABA.</p>
            ) : (
              rows.map((row) => (
                <div key={row.id} className="rounded-lg border border-border px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold m-0">
                      {row.display_name || 'WABA'}
                    </p>
                    <Badge appearance="light" size="sm">
                      {row.status || 'pending'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground m-0 mt-1">
                    Phone ID {row.meta_phone_id || '—'}
                  </p>
                  <p className="text-xs text-muted-foreground m-0">
                    WABA {row.meta_waba_id || '—'}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hubungkan Phone Number ID</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waba-id">WABA ID</Label>
              <Input
                id="waba-id"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-id">Phone Number ID</Label>
              <Input
                id="phone-id"
                value={phoneId}
                onChange={(e) => setPhoneId(e.target.value)}
              />
            </div>
            <Button onClick={() => void onConnect()} disabled={saving || !phoneId.trim()}>
              {saving ? 'Menyimpan…' : 'Simpan'}
            </Button>
            {note ? <p className="text-sm text-muted-foreground m-0">{note}</p> : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
