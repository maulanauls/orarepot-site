const COLORS = {
  text: '#cdd6f4',
  comment: '#6c7086',
  keyword: '#cba6f7',
  string: '#a6e3a1',
  function: '#89b4fa',
  number: '#fab387',
  property: '#f9e2af',
  operator: '#89dceb',
  punctuation: '#9399b2',
  constant: '#f38ba8',
  type: '#94e2d5',
  variable: '#f5c2e7',
} as const;

type Lang = 'typescript' | 'javascript' | 'python' | 'bash' | 'json' | 'http' | 'plaintext';

const LABEL_TO_LANG: Record<string, Lang> = {
  typescript: 'typescript',
  ts: 'typescript',
  javascript: 'javascript',
  js: 'javascript',
  python: 'python',
  py: 'python',
  curl: 'bash',
  shell: 'bash',
  bash: 'bash',
  json: 'json',
  http: 'http',
  header: 'http',
  headers: 'http',
  response: 'json',
};

type Token = { text: string; color?: string };

const JS_KEYWORDS =
  /^(const|let|var|await|async|return|function|import|from|export|default|if|else|for|while|new|class|type|interface|true|false|null|undefined|this|typeof|in|of|try|catch|throw|void|as|satisfies|extends|implements|public|private|readonly)$/;

const PY_KEYWORDS =
  /^(import|from|as|def|return|class|if|elif|else|for|while|in|not|and|or|True|False|None|with|try|except|raise|pass|lambda|async|await)$/;

const BASH_COMMANDS = /^(curl|export|echo|npm|npx|pnpm|git|cat|cd|ls|chmod|sudo)$/;

export function inferLang(label: string, code: string): Lang {
  const key = label.trim().toLowerCase();
  if (LABEL_TO_LANG[key]) return LABEL_TO_LANG[key];

  const trimmed = code.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (/^(curl|export|#)\s/.test(trimmed)) return 'bash';
  if (/^(authorization|x-[\w-]+):/i.test(trimmed)) return 'http';
  if (/^\s*(import |def |requests\.)/.test(trimmed)) return 'python';
  if (/\b(import|export|const|await|fetch)\b/.test(trimmed)) return 'typescript';
  return 'plaintext';
}

export async function highlightCode(code: string, lang: Lang): Promise<string> {
  const source = code.replace(/\n$/, '');
  const lines = source.split('\n').map((line) => {
    const tokens = tokenize(line, lang);
    const inner = tokens
      .map((token) =>
        token.color
          ? `<span style="color:${token.color}">${escapeHtml(token.text)}</span>`
          : escapeHtml(token.text),
      )
      .join('');
    return `<span class="line">${inner || ' '}</span>`;
  });

  return `<pre class="shiki" style="background-color:#1e1e2e;color:${COLORS.text}"><code>${lines.join('\n')}</code></pre>`;
}

function tokenize(line: string, lang: Lang): Token[] {
  if (lang === 'json') return tokenizeJson(line);
  if (lang === 'http') return tokenizeHttp(line);
  if (lang === 'bash') return tokenizeBash(line);
  if (lang === 'python') return tokenizePython(line);
  if (lang === 'typescript' || lang === 'javascript') return tokenizeJs(line);
  return [{ text: line, color: COLORS.text }];
}

function tokenizeJs(line: string): Token[] {
  return scan(line, [
    [/\/\/.*$/, COLORS.comment],
    [/\/\*[\s\S]*?\*\//, COLORS.comment],
    [/`(?:\\.|[^`\\])*`/, COLORS.string],
    [/'([^'\\]|\\.)*'/, COLORS.string],
    [/"([^"\\]|\\.)*"/, COLORS.string],
    [/\b0x[\da-fA-F]+\b/, COLORS.number],
    [/\b\d+\.?\d*\b/, COLORS.number],
    [/\b[A-Za-z_$][\w$]*(?=\s*:)/, COLORS.property],
    [/\b[A-Z][A-Za-z0-9_]*\b/, COLORS.type],
    [/\b[A-Za-z_$][\w$]*(?=\s*\()/, COLORS.function],
    [/\b[A-Za-z_$][\w$]*\b/, (text) => (JS_KEYWORDS.test(text) ? COLORS.keyword : COLORS.text)],
    [/[+\-*/%=<>!&|?:]+/, COLORS.operator],
    [/[{}[\](),.;]/, COLORS.punctuation],
  ]);
}

function tokenizePython(line: string): Token[] {
  return scan(line, [
    [/#.*$/, COLORS.comment],
    [/'([^'\\]|\\.)*'/, COLORS.string],
    [/"([^"\\]|\\.)*"/, COLORS.string],
    [/\b\d+\.?\d*\b/, COLORS.number],
    [/\b[A-Za-z_][\w]*(?=\s*\()/, COLORS.function],
    [/\b[A-Za-z_][\w]*\b/, (text) => (PY_KEYWORDS.test(text) ? COLORS.keyword : COLORS.text)],
    [/[+\-*/%=<>!&|]+/, COLORS.operator],
    [/[{}[\](),.:]/, COLORS.punctuation],
  ]);
}

function tokenizeBash(line: string): Token[] {
  return scan(line, [
    [/#.*$/, COLORS.comment],
    [/'([^'\\]|\\.)*'/, COLORS.string],
    [/"([^"\\]|\\.)*"/, COLORS.string],
    [/https?:\/\/[^\s\\]+/, COLORS.string],
    [/\$\{?[A-Za-z_][\w]*\}?/, COLORS.variable],
    [/\\$/, COLORS.operator],
    [/--?[\w-]+/, COLORS.property],
    [/\b[A-Za-z_][\w.-]*\b/, (text) =>
      BASH_COMMANDS.test(text) ? COLORS.function : COLORS.text,
    ],
  ]);
}

function tokenizeJson(line: string): Token[] {
  return scan(line, [
    [/"([^"\\]|\\.)*"\s*(?=:)/, COLORS.property],
    [/"([^"\\]|\\.)*"/, COLORS.string],
    [/\b-?\d+\.?\d*\b/, COLORS.number],
    [/\b(true|false|null)\b/, COLORS.constant],
    [/[{}[\]:,]/, COLORS.punctuation],
  ]);
}

function tokenizeHttp(line: string): Token[] {
  const idx = line.indexOf(':');
  if (idx === -1) return [{ text: line, color: COLORS.text }];
  return [
    { text: line.slice(0, idx), color: COLORS.property },
    { text: ':', color: COLORS.punctuation },
    { text: line.slice(idx + 1), color: COLORS.string },
  ];
}

type Rule = [RegExp, string | ((text: string) => string | undefined)];

function scan(input: string, rules: Rule[]): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    let next: { index: number; text: string; color?: string } | null = null;

    for (const [pattern, color] of rules) {
      const slice = input.slice(i);
      const match = slice.match(pattern);
      if (!match || match.index === undefined) continue;
      const index = i + match.index;
      if (next && index >= next.index) continue;
      const text = match[0];
      const resolved = typeof color === 'function' ? color(text) : color;
      next = { index, text, color: resolved };
      if (match.index === 0) break;
    }

    if (!next) {
      tokens.push({ text: input[i], color: COLORS.text });
      i += 1;
      continue;
    }

    if (next.index > i) {
      tokens.push({ text: input.slice(i, next.index), color: COLORS.text });
    }
    tokens.push({ text: next.text, color: next.color });
    i = next.index + next.text.length;
  }

  return tokens;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
