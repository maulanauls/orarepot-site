'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

type Props = React.PropsWithChildren<{
  attribute?: 'class' | 'data-theme';
  defaultTheme?: string;
  forcedTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
}>;

export function ThemeProvider({ children, ...props }: Props) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
