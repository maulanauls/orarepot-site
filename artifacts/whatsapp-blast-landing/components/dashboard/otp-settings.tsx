'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  Copy,
  KeyRound,
  ScrollText,
  Send,
  Webhook,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useT } from '@/components/i18n/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  OTP_WEBHOOK_EVENTS,
  createApiKey,
  getApiKeys,
  getApiRequestLogs,
  getWebhook,
  getWebhookDeliveries,
  maskSecret,
  revokeApiKey,
  saveWebhook,
  testWebhook,
  type OtpApiKey,
  type OtpApiRequestLog,
  type OtpWebhook,
  type OtpWebhookDelivery,
  type OtpWebhookEvent,
} from '@/lib/otp-developer';

type Tab = 'summary' | 'keys' | 'webhook' | 'deliveries' | 'requests';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OtpSettingsPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('summary');
  const [keys, setKeys] = useState<OtpApiKey[]>([]);
  const [webhook, setWebhook] = useState<OtpWebhook | null>(null);
  const [deliveries, setDeliveries] = useState<OtpWebhookDelivery[]>([]);
  const [requests, setRequests] = useState<OtpApiRequestLog[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('Production');
  const [freshSecret, setFreshSecret] = useState('');
  const [copied, setCopied] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whEnabled, setWhEnabled] = useState(true);
  const [whEvents, setWhEvents] = useState<OtpWebhookEvent[]>(['otp.sent', 'otp.failed']);
  const [savedNote, setSavedNote] = useState('');

  function reload() {
    const nextKeys = getApiKeys();
    const nextWebhook = getWebhook();
    setKeys(nextKeys);
    setWebhook(nextWebhook);
    setDeliveries(getWebhookDeliveries());
    setRequests(getApiRequestLogs());
    if (nextWebhook) {
      setWhUrl(nextWebhook.url);
      setWhEnabled(nextWebhook.enabled);
      setWhEvents(nextWebhook.events);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function copy(value: string, id: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(''), 1200);
  }

  function onCreateKey() {
    const created = createApiKey(keyName);
    setFreshSecret(created.secret);
    setKeyName('Production');
    reload();
  }

  function onSaveWebhook(rotate = false) {
    const next = saveWebhook({
      url: whUrl,
      events: whEvents,
      enabled: whEnabled,
      rotateSecret: rotate,
    });
    setWebhook(next);
    setSavedNote(t('otp.devSaved'));
    window.setTimeout(() => setSavedNote(''), 1600);
    reload();
  }

  function onTestWebhook() {
    testWebhook();
    reload();
    setTab('deliveries');
  }

  function toggleEvent(event: OtpWebhookEvent, checked: boolean) {
    setWhEvents((current) =>
      checked ? [...current, event] : current.filter((item) => item !== event),
    );
  }

  return (
    <DashboardShell title={t('menu.otpSettings')} subtitle={t('otp.devSubtitle')}>
      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="w-full">
        <TabsList variant="line" className="mb-5 w-full justify-start overflow-x-auto">
          <TabsTrigger value="summary">{t('otp.devSummary')}</TabsTrigger>
          <TabsTrigger value="keys">{t('otp.devApiKey')}</TabsTrigger>
          <TabsTrigger value="webhook">{t('otp.devWebhook')}</TabsTrigger>
          <TabsTrigger value="deliveries">{t('otp.devDeliveries')}</TabsTrigger>
          <TabsTrigger value="requests">{t('otp.devRequests')}</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-5">
          <Card className="border-amber-500/40">
            <CardContent className="py-4">
              <p className="text-sm font-semibold m-0">{t('otp.devWindowTitle')}</p>
              <p className="text-sm text-muted-foreground m-0 mt-1">{t('otp.devWindowBody')}</p>
              <Button variant="outline" size="sm" className="mt-3" asChild>
                <Link href="/dashboard/otp/templates">
                  <BookOpen /> {t('otp.devWindowLink')}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-sm font-semibold m-0 mb-3">{t('otp.devManage')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <SummaryCard
                icon={KeyRound}
                title={t('otp.devApiKey')}
                body={t('otp.devApiKeyDesc')}
                onClick={() => setTab('keys')}
              />
              <SummaryCard
                icon={Webhook}
                title={t('otp.devWebhook')}
                body={t('otp.devWebhookDesc')}
                onClick={() => setTab('webhook')}
              />
              <SummaryCard
                icon={Send}
                title={t('otp.devDeliveries')}
                body={t('otp.devDeliveriesDesc')}
                onClick={() => setTab('deliveries')}
              />
              <SummaryCard
                icon={ScrollText}
                title={t('otp.devRequests')}
                body={t('otp.devRequestsDesc')}
                onClick={() => setTab('requests')}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="keys">
          <Card>
            <CardHeader className="py-4">
              <div>
                <CardTitle>{t('otp.devApiKey')}</CardTitle>
                <p className="text-sm text-muted-foreground m-0 mt-1">{t('otp.devApiKeyLead')}</p>
              </div>
              <Button onClick={() => { setFreshSecret(''); setCreateOpen(true); }}>
                {t('otp.devCreateKey')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {keys.length === 0 ? (
                <p className="text-sm text-muted-foreground m-0">{t('otp.devNoKeys')}</p>
              ) : (
                keys.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold m-0">{item.name}</p>
                      <p className="text-xs font-mono text-muted-foreground m-0">
                        {item.prefix}••••{item.last4}
                      </p>
                      <p className="text-xs text-muted-foreground m-0">
                        {t('otp.devCreated', { time: formatWhen(item.createdAt) })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={item.revoked ? 'destructive' : 'success'}
                        appearance="light"
                        size="sm"
                      >
                        {item.revoked ? t('otp.devRevoked') : t('otp.devActive')}
                      </Badge>
                      {!item.revoked ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            revokeApiKey(item.id);
                            reload();
                          }}
                        >
                          {t('otp.devRevoke')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <p className="text-xs text-muted-foreground m-0 pt-2">
                {t('otp.devApiHint')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhook">
          <Card>
            <CardHeader className="py-4">
              <div>
                <CardTitle>{t('otp.devWebhook')}</CardTitle>
                <p className="text-sm text-muted-foreground m-0 mt-1">{t('otp.devWebhookLead')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="wh-enabled" className="text-sm">
                  {t('otp.devEnabled')}
                </Label>
                <Switch
                  id="wh-enabled"
                  checked={whEnabled}
                  onCheckedChange={setWhEnabled}
                  size="sm"
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wh-url">{t('otp.devWebhookUrl')}</Label>
                <Input
                  id="wh-url"
                  placeholder="https://merchant.com/webhooks/orarepot"
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('otp.devEvents')}</Label>
                {OTP_WEBHOOK_EVENTS.map((event) => (
                  <div key={event} className="flex items-center gap-2.5">
                    <Checkbox
                      id={event}
                      checked={whEvents.includes(event)}
                      onCheckedChange={(checked) => toggleEvent(event, checked === true)}
                    />
                    <Label htmlFor={event} className="font-normal">
                      {event}
                    </Label>
                  </div>
                ))}
              </div>
              {webhook ? (
                <div className="rounded-lg border border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground m-0">{t('otp.devSigningSecret')}</p>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <code className="text-xs">{maskSecret(webhook.secret)}</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copy(webhook.secret, 'secret')}
                    >
                      {copied === 'secret' ? <CheckCircle2 /> : <Copy />}
                    </Button>
                  </div>
                </div>
              ) : null}
              {savedNote ? <p className="text-sm text-primary m-0">{savedNote}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => onSaveWebhook(false)} disabled={!whUrl.trim()}>
                  {t('common.save')}
                </Button>
                <Button variant="outline" onClick={() => onSaveWebhook(true)} disabled={!whUrl.trim()}>
                  {t('otp.devRotateSecret')}
                </Button>
                <Button variant="outline" onClick={onTestWebhook} disabled={!webhook}>
                  {t('otp.devTestWebhook')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries">
          <Card>
            <CardHeader className="py-4">
              <div>
                <CardTitle>{t('otp.devDeliveries')}</CardTitle>
                <p className="text-sm text-muted-foreground m-0 mt-1">{t('otp.devDeliveriesLead')}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {deliveries.length === 0 ? (
                <p className="text-sm text-muted-foreground m-0">{t('otp.devNoDeliveries')}</p>
              ) : (
                deliveries.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium m-0">{row.event}</p>
                      <p className="text-xs text-muted-foreground m-0 break-all">{row.url}</p>
                      <p className="text-xs text-muted-foreground m-0">{formatWhen(row.createdAt)}</p>
                    </div>
                    <Badge
                      variant={row.status === 'Failed' ? 'destructive' : 'success'}
                      appearance="light"
                      size="sm"
                    >
                      {row.status === 'Failed' ? t('otp.logFailed') : t('otp.logSuccess')}
                      {row.code ? ` · ${row.code}` : ''}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests">
          <Card>
            <CardHeader className="py-4">
              <div>
                <CardTitle>{t('otp.devRequests')}</CardTitle>
                <p className="text-sm text-muted-foreground m-0 mt-1">{t('otp.devRequestsLead')}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium m-0">
                      {row.method} {row.path}
                    </p>
                    <p className="text-xs text-muted-foreground m-0">
                      {row.keyPrefix} · {formatWhen(row.createdAt)}
                    </p>
                  </div>
                  <Badge
                    variant={row.status >= 400 ? 'destructive' : 'success'}
                    appearance="light"
                    size="sm"
                  >
                    {row.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setFreshSecret('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('otp.devCreateKey')}</DialogTitle>
            <DialogDescription>{t('otp.devCreateKeyDesc')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {freshSecret ? (
              <div className="space-y-2">
                <Label>{t('otp.devNewSecret')}</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={freshSecret} className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    mode="icon"
                    onClick={() => copy(freshSecret, 'new')}
                  >
                    {copied === 'new' ? <CheckCircle2 /> : <Copy />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground m-0">{t('otp.devSecretOnce')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="key-name">{t('otp.devKeyName')}</Label>
                <Input
                  id="key-name"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                />
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {freshSecret ? t('common.save') : t('common.cancel')}
            </Button>
            {!freshSecret ? (
              <Button onClick={onCreateKey} disabled={!keyName.trim()}>
                {t('otp.devCreateKey')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  body,
  onClick,
}: {
  icon: typeof KeyRound;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-border bg-card px-5 py-4 text-start hover:bg-muted/50 transition-colors"
    >
      <span className="size-9 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center mb-3">
        <Icon className="size-4" />
      </span>
      <p className="text-sm font-semibold m-0">{title}</p>
      <p className="text-xs text-muted-foreground m-0 mt-1">{body}</p>
    </button>
  );
}
