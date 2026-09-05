'use client';

import { useEffect, useMemo, useState } from 'react';
import { Crown, Mail, Search, Shield, UserRound } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { useT } from '@/components/i18n/locale-provider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  countByRole,
  initials,
  type MemberRole,
  type TeamMember,
} from '@/lib/members';
import { fetchMembers, inviteMemberApi } from '@/lib/orarepot-api';

type RoleFilter = 'all' | MemberRole;

function RoleBadge({ role, label }: { role: MemberRole; label: string }) {
  if (role === 'owner') {
    return (
      <Badge variant="warning" appearance="light" size="sm" className="gap-1">
        <Crown className="size-3" />
        {label}
      </Badge>
    );
  }
  if (role === 'admin') {
    return (
      <Badge variant="info" appearance="light" size="sm" className="gap-1">
        <Shield className="size-3" />
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" appearance="light" size="sm" className="gap-1">
      <UserRound className="size-3" />
      {label}
    </Badge>
  );
}

export function MembersPage() {
  const t = useT();
  const [rows, setRows] = useState<TeamMember[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Exclude<MemberRole, 'owner'>>('agent');

  useEffect(() => {
    fetchMembers()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  const counts = countByRole(rows);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== 'all' && row.role !== filter) return false;
      if (!q) return true;
      return (
        row.fullName.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.role.includes(q)
      );
    });
  }, [rows, query, filter]);

  async function onInvite() {
    if (!email.trim()) return;
    try {
      await inviteMemberApi({
        fullName,
        email,
        role,
      });
      setRows(await fetchMembers());
      setEmail('');
      setFullName('');
      setRole('agent');
      setInviteOpen(false);
    } catch {
      /* keep dialog open */
    }
  }

  const filters: { id: RoleFilter; label: string; count: number }[] = [
    { id: 'all', label: t('members.filterAll'), count: counts.all },
    { id: 'owner', label: t('members.roleOwner'), count: counts.owner },
    { id: 'admin', label: t('members.roleAdmin'), count: counts.admin },
    { id: 'agent', label: t('members.roleAgent'), count: counts.agent },
  ];

  return (
    <DashboardShell
      title={t('menu.members')}
      subtitle={t('page.members')}
      actions={
        <Button onClick={() => setInviteOpen(true)}>
          <Mail /> {t('members.invite')}
        </Button>
      }
    >
      <div className="space-y-5">
        <Card>
          <CardHeader className="py-4">
            <CardTitle>{t('members.diffTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <RoleExplain
              icon={Crown}
              title={t('members.roleOwner')}
              body={t('members.diffOwner')}
            />
            <RoleExplain
              icon={Shield}
              title={t('members.roleAdmin')}
              body={t('members.diffAdmin')}
            />
            <RoleExplain
              icon={UserRound}
              title={t('members.roleAgent')}
              body={t('members.diffAgent')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="py-4 gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('members.search')}
                className="ps-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {filters.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant={filter === item.id ? 'primary' : 'outline'}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                  <span className="ms-1 text-xs opacity-70">{item.count}</span>
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">{t('members.colMember')}</th>
                    <th className="px-5 py-3 font-medium">{t('members.colEmail')}</th>
                    <th className="px-5 py-3 font-medium">{t('members.colRole')}</th>
                    <th className="px-5 py-3 font-medium">{t('members.colTeam')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            <AvatarFallback className="text-xs">
                              {initials(row.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="m-0 font-medium">{row.fullName}</p>
                            <p className="m-0 text-xs text-muted-foreground">{row.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{row.email}</td>
                      <td className="px-5 py-3">
                        <RoleBadge
                          role={row.role}
                          label={
                            row.role === 'owner'
                              ? t('members.roleOwner')
                              : row.role === 'admin'
                                ? t('members.roleAdmin')
                                : t('members.roleAgent')
                          }
                        />
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="outline" appearance="light" size="sm">
                          {row.teamName ?? t('members.allTeams')}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('members.invite')}</DialogTitle>
            <DialogDescription>{t('members.inviteLead')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mem-name">{t('members.fullName')}</Label>
              <Input
                id="mem-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t('members.fullNamePh')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mem-email">{t('members.colEmail')}</Label>
              <Input
                id="mem-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@toko.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{t('members.colRole')}</Label>
              <Select
                value={role}
                onValueChange={(value) => setRole(value as Exclude<MemberRole, 'owner'>)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('members.roleAdmin')}</SelectItem>
                  <SelectItem value="agent">{t('members.roleAgent')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={onInvite} disabled={!email.trim()}>
              {t('members.inviteSend')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function RoleExplain({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Crown;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="m-0 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </p>
      <p className="m-0 mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
