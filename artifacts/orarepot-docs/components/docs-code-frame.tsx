'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type HighlightedTab = {
  label: string;
  code: string;
  html: string;
};

export function DocsCodeFrame({ tabs }: { tabs: HighlightedTab[] }) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const current = tabs[active] ?? tabs[0];

  async function copy() {
    await navigator.clipboard.writeText(current.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="docs-code my-5 overflow-hidden rounded-xl border border-white/10 shadow-[0_16px_40px_-18px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-1 border-b border-white/10 bg-[#0c1a17] px-2 min-h-11">
        {tabs.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActive(index)}
            className={
              active === index
                ? 'h-11 px-3 text-xs font-medium text-[#c6e800] border-b-2 border-[#c6e800]'
                : 'h-11 px-3 text-xs font-medium text-zinc-400 hover:text-zinc-100'
            }
          >
            {tab.label}
          </button>
        ))}
        <Button
          variant="ghost"
          mode="icon"
          size="sm"
          className="ms-auto text-zinc-400 hover:text-zinc-100 hover:bg-white/10"
          onClick={copy}
          aria-label="Copy code"
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <div
        className="docs-code-body"
        dangerouslySetInnerHTML={{ __html: current.html }}
      />
    </div>
  );
}
