import { DocsCodeFrame } from '@/components/docs-code-frame';
import { highlightCode, inferLang } from '@/lib/highlight';

export async function CodeTabs({
  tabs,
}: {
  tabs: { label: string; code: string; lang?: string }[];
}) {
  const highlighted = await Promise.all(
    tabs.map(async (tab) => ({
      label: tab.label,
      code: tab.code,
      html: await highlightCode(
        tab.code,
        inferLang(tab.lang ?? tab.label, tab.code),
      ),
    })),
  );

  return <DocsCodeFrame tabs={highlighted} />;
}

export async function CodeBlock({
  title,
  lang,
  children,
}: {
  title?: string;
  lang?: string;
  children: string;
}) {
  return <CodeTabs tabs={[{ label: title ?? 'Code', code: children, lang }]} />;
}
