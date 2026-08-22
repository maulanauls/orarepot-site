'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  RowSelectionState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ChevronDown,
  Filter,
  Info,
  LayoutTemplate,
  Plus,
  Search,
  Settings2,
  X,
} from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTable,
  CardToolbar,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataGrid, useDataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridColumnVisibility } from '@/components/ui/data-grid-column-visibility';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import {
  DataGridTable,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from '@/components/ui/data-grid-table';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useT } from '@/components/i18n/locale-provider';
import {
  CATEGORY_LABEL,
  bodyPreview,
  formatDateId,
  getAllTemplates,
  saveNewTemplate,
  type OtpTemplate,
  type OtpTemplateCategory,
  type OtpTemplateStatus,
} from '@/lib/otp-templates';

const CATEGORIES: OtpTemplateCategory[] = [
  'AUTHENTICATION',
  'UTILITY',
  'MARKETING',
];
const STATUSES: OtpTemplateStatus[] = [
  'ACTIVE',
  'PENDING',
  'REJECTED',
  'PAUSED',
];
const LANGUAGES = ['Indonesian', 'English (US)'] as const;

function statusBadge(t: OtpTemplate) {
  const label = t.statusLabel || CATEGORY_LABEL[t.category];
  if (t.status === 'REJECTED') {
    return (
      <Badge variant="destructive" appearance="light" size="sm">
        {label}
      </Badge>
    );
  }
  if (t.status === 'PENDING') {
    return (
      <Badge variant="warning" appearance="light" size="sm">
        {label}
      </Badge>
    );
  }
  if (t.status === 'PAUSED') {
    return (
      <Badge variant="secondary" appearance="light" size="sm">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="success" appearance="light" size="sm">
      {label}
    </Badge>
  );
}

export function OtpTemplatesPage() {
  const t = useT();
  const router = useRouter();
  const [templates, setTemplates] = useState<OtpTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [range, setRange] = useState('7d');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLang, setFormLang] = useState('Indonesian');
  const [formBody, setFormBody] = useState(
    '{{1}} adalah kode verifikasi Anda. Demi keamanan, jangan bagikan kode ini.',
  );
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updatedAt', desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    setTemplates(getAllTemplates());
  }, []);

  const filteredData = useMemo(() => {
    let rows = [...templates];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.body.toLowerCase().includes(q) ||
          r.language.toLowerCase().includes(q),
      );
    }
    if (selectedCategories.length) {
      rows = rows.filter((r) => selectedCategories.includes(r.category));
    }
    if (selectedLanguages.length) {
      rows = rows.filter((r) => selectedLanguages.includes(r.language));
    }
    if (selectedStatuses.length) {
      rows = rows.filter((r) => selectedStatuses.includes(r.status));
    }
    return rows;
  }, [
    templates,
    searchQuery,
    selectedCategories,
    selectedLanguages,
    selectedStatuses,
  ]);

  const activeCount = useMemo(
    () => templates.filter((t) => t.status === 'ACTIVE').length,
    [templates],
  );

  const columns = useMemo<ColumnDef<OtpTemplate>[]>(
    () => [
      {
        accessorKey: 'id',
        id: 'select',
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: 'name',
        id: 'name',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colName')} column={column} />
        ),
        cell: ({ row }) => (
          <Link
            href={`/dashboard/otp/templates/${row.original.id}`}
            className="font-medium text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
        size: 180,
        enableSorting: true,
        enableHiding: false,
      },
      {
        accessorKey: 'category',
        id: 'category',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colCategory')} column={column} />
        ),
        cell: ({ row }) => (
          <span>
            {t(
              row.original.category === 'AUTHENTICATION'
                ? 'otp.catAuth'
                : row.original.category === 'UTILITY'
                  ? 'otp.catUtility'
                  : 'otp.catMarketing',
            )}
          </span>
        ),
        size: 130,
        enableSorting: true,
      },
      {
        accessorKey: 'language',
        id: 'language',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colLanguage')} column={column} />
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5 py-0.5">
            <span className="text-foreground">{row.original.language}</span>
            <span className="text-xs text-muted-foreground line-clamp-1">
              {bodyPreview(row.original.body)}
            </span>
          </div>
        ),
        size: 220,
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        id: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colStatus')} column={column} />
        ),
        cell: ({ row }) => statusBadge(row.original),
        size: 180,
        enableSorting: true,
      },
      {
        accessorKey: 'messagesSent',
        id: 'messagesSent',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colSent')} column={column} />
        ),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            {row.original.messagesSent.toLocaleString('id-ID')}
            <Info className="size-3.5 text-muted-foreground" />
          </span>
        ),
        size: 130,
        enableSorting: true,
      },
      {
        accessorKey: 'readRate',
        id: 'readRate',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colReadRate')} column={column} />
        ),
        cell: ({ row }) => {
          const pct = Math.round(row.original.readRate * 100);
          const reads = row.original.messagesRead;
          return (
            <span className="inline-flex items-center gap-1">
              {pct}% ({reads.toLocaleString('id-ID')})
              <Info className="size-3.5 text-muted-foreground" />
            </span>
          );
        },
        size: 150,
        enableSorting: true,
      },
      {
        accessorKey: 'updatedAt',
        id: 'updatedAt',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colUpdated')} column={column} />
        ),
        cell: ({ row }) => formatDateId(row.original.updatedAt),
        size: 140,
        enableSorting: true,
      },
    ],
    [t],
  );

  const table = useReactTable({
    columns,
    data: filteredData,
    pageCount: Math.ceil((filteredData.length || 0) / pagination.pageSize),
    getRowId: (row) => row.id,
    state: { pagination, sorting, rowSelection },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const toggleFilter = (
    list: string[],
    setList: (v: string[]) => void,
    value: string,
    checked: boolean,
  ) => {
    setList(checked ? [...list, value] : list.filter((x) => x !== value));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const onCreate = () => {
    if (!formName.trim() || !formBody.trim()) return;
    setCreating(true);
    const langCode = formLang === 'English (US)' ? 'en_US' : 'id';
    const created = saveNewTemplate({
      name: formName,
      language: formLang,
      languageCode: langCode,
      body: formBody,
      category: 'AUTHENTICATION',
    });
    setTemplates(getAllTemplates());
    setCreateOpen(false);
    setCreating(false);
    setFormName('');
    router.push(`/dashboard/otp/templates/${created.id}`);
  };

  const Toolbar = () => {
    const { table: gridTable } = useDataGrid();
    return (
      <CardToolbar>
        <DataGridColumnVisibility
          table={gridTable}
          trigger={
            <Button variant="outline">
              <Settings2 /> {t('common.columns')}
            </Button>
          }
        />
            <Button onClick={() => setCreateOpen(true)}>
          <Plus /> {t('otp.createTemplate')}
        </Button>
      </CardToolbar>
    );
  };

  return (
    <DashboardShell
      title={t('otp.templatesTitle')}
      subtitle={t('otp.templatesSubtitle')}
    >
      <Tabs defaultValue="template" className="w-full">
        <TabsList variant="default" className="mb-5 w-fit">
          <TabsTrigger value="template">{t('otp.tabTemplate')}</TabsTrigger>
          <TabsTrigger value="group">{t('otp.tabGroup')}</TabsTrigger>
        </TabsList>

        <TabsContent value="template" className="mt-0">
          <DataGrid
            table={table}
            recordCount={filteredData.length}
            tableLayout={{
              columnsPinnable: true,
              columnsMovable: true,
              columnsVisibility: true,
              cellBorder: true,
            }}
          >
            <Card>
              <CardHeader>
                <CardHeading>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="relative">
                      <Search className="size-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
                      <Input
                        placeholder={t('otp.searchTemplates')}
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setPagination((p) => ({ ...p, pageIndex: 0 }));
                        }}
                        className="ps-9 w-40 sm:w-48"
                      />
                      {searchQuery.length > 0 && (
                        <Button
                          mode="icon"
                          variant="ghost"
                          className="absolute end-1.5 top-1/2 -translate-y-1/2 h-6 w-6"
                          onClick={() => setSearchQuery('')}
                        >
                          <X />
                        </Button>
                      )}
                    </div>

                    <FilterPopover
                      label={t('otp.colCategory')}
                      optionsSelectedLabel={t('otp.optionsSelected', {
                        count: selectedCategories.length,
                      })}
                      options={CATEGORIES.map((c) => ({
                        value: c,
                        label: t(
                          c === 'AUTHENTICATION'
                            ? 'otp.catAuth'
                            : c === 'UTILITY'
                              ? 'otp.catUtility'
                              : 'otp.catMarketing',
                        ),
                      }))}
                      selected={selectedCategories}
                      onToggle={(value, checked) =>
                        toggleFilter(
                          selectedCategories,
                          setSelectedCategories,
                          value,
                          checked,
                        )
                      }
                    />
                    <FilterPopover
                      label={t('otp.colLanguage')}
                      optionsSelectedLabel={t('otp.optionsSelected', {
                        count: selectedLanguages.length,
                      })}
                      options={LANGUAGES.map((l) => ({
                        value: l,
                        label:
                          l === 'Indonesian'
                            ? t('otp.langIndonesian')
                            : t('otp.langEnglish'),
                      }))}
                      selected={selectedLanguages}
                      onToggle={(value, checked) =>
                        toggleFilter(
                          selectedLanguages,
                          setSelectedLanguages,
                          value,
                          checked,
                        )
                      }
                    />
                    <FilterPopover
                      label={t('otp.colStatus')}
                      optionsSelectedLabel={t('otp.optionsSelected', {
                        count: selectedStatuses.length,
                      })}
                      options={STATUSES.map((s) => ({
                        value: s,
                        label: t(
                          s === 'ACTIVE'
                            ? 'otp.statusActive'
                            : s === 'PENDING'
                              ? 'otp.statusPending'
                              : s === 'REJECTED'
                                ? 'otp.statusRejected'
                                : 'otp.statusPaused',
                        ),
                      }))}
                      selected={selectedStatuses}
                      onToggle={(value, checked) =>
                        toggleFilter(
                          selectedStatuses,
                          setSelectedStatuses,
                          value,
                          checked,
                        )
                      }
                    />

                    <Select value={range} onValueChange={setRange}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t('otp.rangePlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">{t('otp.range7d')}</SelectItem>
                        <SelectItem value="30d">{t('otp.range30d')}</SelectItem>
                        <SelectItem value="90d">{t('otp.range90d')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeading>
                <Toolbar />
              </CardHeader>
              <CardTable>
                <ScrollArea>
                  <DataGridTable />
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </CardTable>
              <CardFooter className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground m-0 inline-flex items-center gap-1">
                  {t('otp.templatesShown', {
                    shown: filteredData.length,
                    active: activeCount,
                    total: templates.length,
                  })}
                  <Info className="size-3.5" />
                </p>
                <DataGridPagination />
              </CardFooter>
            </Card>
          </DataGrid>
        </TabsContent>

        <TabsContent value="group" className="mt-0">
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <LayoutTemplate className="size-10 text-muted-foreground" />
              <h3 className="text-base font-semibold text-mono m-0">
                {t('otp.groupEmptyTitle')}
              </h3>
              <p className="text-sm text-muted-foreground m-0 max-w-md">
                {t('otp.groupEmptyBody')}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('otp.createTitle')}</DialogTitle>
            <DialogDescription>{t('otp.createDesc')}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">{t('otp.templateName')}</Label>
              <Input
                id="tpl-name"
                placeholder="otp_verification"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.language')}</Label>
              <Select value={formLang} onValueChange={setFormLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-body">{t('otp.messageBody')}</Label>
              <textarea
                id="tpl-body"
                className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:border-ring"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
              />
              <p className="text-xs text-muted-foreground m-0">
                {t('otp.otpVarHint')}
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={onCreate}
              disabled={creating || !formName.trim() || !formBody.trim()}
            >
              {creating ? t('otp.saving') : t('otp.saveDraft')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function FilterPopover({
  label,
  optionsSelectedLabel,
  options,
  selected,
  onToggle,
}: {
  label: string;
  optionsSelectedLabel?: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Filter />
          {selected.length > 0
            ? (optionsSelectedLabel ?? `${selected.length}`)
            : label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" align="start">
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          {options.map((opt) => (
            <div key={opt.value} className="flex items-center gap-2.5">
              <Checkbox
                id={`${label}-${opt.value}`}
                checked={selected.includes(opt.value)}
                onCheckedChange={(checked) =>
                  onToggle(opt.value, checked === true)
                }
              />
              <Label
                htmlFor={`${label}-${opt.value}`}
                className="grow font-normal"
              >
                {opt.label}
              </Label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
