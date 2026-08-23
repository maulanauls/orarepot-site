'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageSquare, Users } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useT } from '@/components/i18n/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatIdr as formatBillingIdr, remainingBalance, remainingUnits, getAccount } from '@/lib/billing';
import { OTP_COST_PER_MESSAGE, getAllTemplates, renderBodySample, type OtpTemplate } from '@/lib/otp-templates';
import { canAffordOtp, parsePhoneNumbers, sendOtpBatch } from '@/lib/otp-send';
import { cn } from '@/lib/utils';

type SendMode = 'single' | 'bulk';

function categoryKey(category: OtpTemplate['category']) {
  if (category === 'AUTHENTICATION') return 'otp.catAuth';
  if (category === 'UTILITY') return 'otp.catUtility';
  return 'otp.catMarketing';
}

export function OtpSendPage() {
  const t = useT();
  const [templates, setTemplates] = useState<OtpTemplate[]>([]);
  const [mode, setMode] = useState<SendMode>('single');
  const [templateId, setTemplateId] = useState('');
  const [singlePhone, setSinglePhone] = useState('');
  const [bulkPhones, setBulkPhones] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [doneCount, setDoneCount] = useState(0);
  const [balance, setBalance] = useState(0);
  const [otpLeft, setOtpLeft] = useState(0);

  const activeTemplates = useMemo(
    () => templates.filter((item) => item.status === 'ACTIVE'),
    [templates],
  );

  useEffect(() => {
    const list = getAllTemplates();
    setTemplates(list);
    const firstActive = list.find((item) => item.status === 'ACTIVE');
    if (firstActive) setTemplateId(firstActive.id);
    const account = getAccount();
    setBalance(remainingBalance(account));
    setOtpLeft(remainingUnits(account, 'otp'));
  }, []);

  const template = activeTemplates.find((item) => item.id === templateId);
  const raw = mode === 'single' ? singlePhone : bulkPhones;
  const parsed = useMemo(() => parsePhoneNumbers(raw), [raw]);
  const cost = parsed.valid.length * OTP_COST_PER_MESSAGE;
  const sampleBody = template ? renderBodySample(template.body) : '';

  function onSend() {
    setError('');
    setDoneCount(0);
    if (!template) {
      setError(t('otp.sendNeedTemplate'));
      return;
    }
    if (parsed.valid.length === 0) {
      setError(t('otp.sendNeedPhone'));
      return;
    }
    if (!canAffordOtp(parsed.valid.length)) {
      setError(t('otp.sendNoBalance'));
      return;
    }
    setSending(true);
    window.setTimeout(() => {
      sendOtpBatch({ phones: parsed.valid, template });
      const account = getAccount();
      setBalance(remainingBalance(account));
      setOtpLeft(remainingUnits(account, 'otp'));
      setDoneCount(parsed.valid.length);
      if (mode === 'single') setSinglePhone('');
      else setBulkPhones('');
      setSending(false);
    }, 450);
  }

  return (
    <DashboardShell title={t('otp.sendTitle')} subtitle={t('otp.sendSubtitle')}>
      <div className="grid gap-5 lg:grid-cols-12 lg:gap-7.5 items-start">
        <Card className="lg:col-span-7">
          <CardHeader className="py-4">
            <div>
              <CardTitle>{t('otp.sendTitle')}</CardTitle>
              <p className="text-sm text-muted-foreground m-0 mt-1">{t('otp.sendLead')}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={cn(
                  'rounded-lg border px-4 py-3 text-start transition-colors',
                  mode === 'single'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/60',
                )}
              >
                <p className="text-sm font-semibold m-0 inline-flex items-center gap-2">
                  <MessageSquare className="size-3.5" />
                  {t('otp.sendSingle')}
                </p>
                <p className="text-xs text-muted-foreground m-0 mt-1">{t('otp.sendSingleDesc')}</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('bulk')}
                className={cn(
                  'rounded-lg border px-4 py-3 text-start transition-colors',
                  mode === 'bulk'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/60',
                )}
              >
                <p className="text-sm font-semibold m-0 inline-flex items-center gap-2">
                  <Users className="size-3.5" />
                  {t('otp.sendBulk')}
                </p>
                <p className="text-xs text-muted-foreground m-0 mt-1">{t('otp.sendBulkDesc')}</p>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label>{t('otp.sendTemplate')}</Label>
                <Link
                  href="/dashboard/otp/templates"
                  className="text-xs text-primary hover:underline"
                >
                  {t('otp.sendManageTemplates')}
                </Link>
              </div>
              {activeTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground m-0">{t('otp.sendTemplateEmpty')}</p>
              ) : (
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('otp.sendTemplatePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeTemplates.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} · {t(categoryKey(item.category))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {mode === 'single' ? (
              <div className="space-y-2">
                <Label htmlFor="otp-phone">{t('otp.sendPhone')}</Label>
                <Input
                  id="otp-phone"
                  inputMode="tel"
                  placeholder={t('otp.sendPhonePlaceholder')}
                  value={singlePhone}
                  onChange={(e) => setSinglePhone(e.target.value)}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="otp-bulk">{t('otp.sendBulkPhones')}</Label>
                <textarea
                  id="otp-bulk"
                  rows={8}
                  value={bulkPhones}
                  onChange={(e) => setBulkPhones(e.target.value)}
                  placeholder={t('otp.sendBulkPlaceholder')}
                  className="flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-[0.8125rem] text-foreground shadow-xs placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                />
              </div>
            )}

            {parsed.valid.length > 0 ? (
              <p className="text-xs text-muted-foreground m-0">
                {t('otp.sendCount', { count: parsed.valid.length })}
                {parsed.invalid.length > 0
                  ? ` · ${t('otp.sendInvalid', { count: parsed.invalid.length })}`
                  : ''}
              </p>
            ) : null}

            {error ? (
              <p className="text-sm text-destructive m-0" role="alert">
                {error}
              </p>
            ) : null}
            {doneCount > 0 ? (
              <p className="text-sm text-primary m-0">
                {t('otp.sendDone', { count: doneCount })}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground m-0">{t('otp.sendTotal')}</p>
              <p className="text-lg font-semibold text-mono m-0">{formatBillingIdr(cost)}</p>
            </div>
            <Button onClick={onSend} disabled={sending || !template}>
              {sending ? t('otp.sendSending') : t('otp.sendSubmit')}
              <ArrowRight />
            </Button>
          </CardFooter>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="py-4">
            <div>
              <CardTitle>{t('otp.sendPreview')}</CardTitle>
              <p className="text-sm text-muted-foreground m-0 mt-1">{t('otp.sendCodeHint')}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {template ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success" appearance="light" size="sm">
                    {t('otp.statusActive')}
                  </Badge>
                  <Badge variant="outline" size="sm">
                    {t(categoryKey(template.category))}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{template.language}</span>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                  <p className="text-sm leading-6 m-0 whitespace-pre-wrap">{sampleBody}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground m-0">{t('otp.sendTemplateEmpty')}</p>
            )}

            <div className="rounded-lg border border-border px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('otp.sendCost')}</span>
                <strong>{formatBillingIdr(OTP_COST_PER_MESSAGE)}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('billing.remaining')}</span>
                <strong>{formatBillingIdr(balance)}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">{t('billing.featOtp')}</span>
                <strong>±{otpLeft}</strong>
              </div>
            </div>

            {doneCount > 0 ? (
              <Button variant="outline" className="w-full" asChild>
                <Link href="/dashboard/otp/logs">
                  {t('otp.sendViewLogs')} <ArrowRight />
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
