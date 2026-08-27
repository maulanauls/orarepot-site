'use client';

import { FormEvent, ReactNode, useState } from 'react';
import { Headphones, Send } from 'lucide-react';
import { useT } from '@/components/i18n/locale-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { toAbsoluteUrl } from '@/lib/helpers';
import { dashboardPoppins } from '@/lib/fonts/dashboard';
import { cn } from '@/lib/utils';

type Msg = {
  id: string;
  from: 'admin' | 'me';
  text: string;
  time: string;
};

const SEED: Msg[] = [
  {
    id: '1',
    from: 'admin',
    text: 'Halo! Saya dari tim support Ora Repot. Ada yang bisa dibantu terkait OTP, WABA, atau billing?',
    time: '10:02',
  },
  {
    id: '2',
    from: 'me',
    text: 'Mau tanya status template OTP saya.',
    time: '10:03',
  },
  {
    id: '3',
    from: 'admin',
    text: 'Siap. Nanti live chat ini terhubung langsung ke admin Ora Repot. Untuk sekarang masih preview UI.',
    time: '10:04',
  },
];

export function ChatSheet({ trigger }: { trigger: ReactNode }) {
  const t = useT();
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [draft, setDraft] = useState('');

  function onSend(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setMessages((prev) => [
      ...prev,
      { id: String(Date.now()), from: 'me', text, time },
    ]);
    setDraft('');
  }

  return (
    <Sheet>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        className={cn(
          dashboardPoppins.className,
          'gap-0 sm:w-[400px] inset-5 start-auto h-auto rounded-lg p-0 sm:max-w-none [&_[data-slot=sheet-close]]:top-4.5 [&_[data-slot=sheet-close]]:end-5 flex flex-col',
        )}
      >
        <SheetHeader className="mb-0 border-b border-border">
          <SheetTitle className="p-3 flex items-center gap-3">
            <span className="size-9 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center">
              <Headphones className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold uppercase tracking-wide">
                {t('header.chatTitle')}
              </span>
              <span className="block text-xs font-normal text-muted-foreground">
                {t('header.chatSubtitle')}
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>

        <SheetBody className="grow p-0 min-h-0">
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2 text-xs text-foreground">
            {t('header.chatBanner')}
          </div>
          <ScrollArea className="h-[calc(100vh-16rem)] px-4 py-4">
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'flex gap-2 max-w-[90%]',
                    m.from === 'me' ? 'ms-auto flex-row-reverse' : '',
                  )}
                >
                  {m.from === 'admin' ? (
                    <Avatar className="size-8 shrink-0">
                      <AvatarImage
                        src={toAbsoluteUrl('/logo-orarepot-icon.svg')}
                        alt="Ora Repot"
                      />
                      <AvatarFallback>OR</AvatarFallback>
                    </Avatar>
                  ) : null}
                  <div>
                    <div
                      className={cn(
                        'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                        m.from === 'me'
                          ? 'bg-primary text-primary-foreground rounded-ee-md'
                          : 'bg-muted text-foreground rounded-es-md',
                      )}
                    >
                      {m.text}
                    </div>
                    <div
                      className={cn(
                        'text-[10px] text-muted-foreground mt-1',
                        m.from === 'me' ? 'text-end' : '',
                      )}
                    >
                      {m.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetBody>

        <SheetFooter className="border-t border-border p-3">
          <form className="flex w-full items-center gap-2" onSubmit={onSend}>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('header.chatPlaceholder')}
              className="flex-1"
            />
            <Button type="submit" size="sm" mode="icon" disabled={!draft.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
