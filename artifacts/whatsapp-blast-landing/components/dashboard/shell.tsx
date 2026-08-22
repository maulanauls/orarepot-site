'use client';

import {
  Toolbar,
  ToolbarActions,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle,
} from '@/components/layouts/layout-1/components/toolbar';

/**
 * Full-width content shell (container-fluid) — avoids Tailwind default
 * `.container` max-width breakpoints that shrink the page.
 */
export function DashboardShell({
  title,
  subtitle,
  actions,
  children,
}: {
  mode?: 'user' | 'admin';
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="container-fluid">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>{title}</ToolbarPageTitle>
          {subtitle ? <ToolbarDescription>{subtitle}</ToolbarDescription> : null}
        </ToolbarHeading>
        {actions ? <ToolbarActions>{actions}</ToolbarActions> : null}
      </Toolbar>
      {children}
    </div>
  );
}
