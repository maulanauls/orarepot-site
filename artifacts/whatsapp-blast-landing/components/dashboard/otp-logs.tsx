'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ColumnDef,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, Filter, Search, Settings2, X } from 'lucide-react';
import { DashboardShell } from '@/components/dashboard/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
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
import { DataGridTable } from '@/components/ui/data-grid-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useT } from '@/components/i18n/locale-provider';
import {
  getAllOtpLogs,
  otpLogTemplates,
  OTP_STATUSES,
  type OtpLog,
  type OtpLogStatus,
} from '@/lib/otp-logs';

function statusBadge(status: OtpLogStatus, label: string) {
  if (status === 'Failed') {
    return (
      <Badge variant="destructive" appearance="light" size="sm">
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

export function OtpLogsPage() {
  const t = useT();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'waktu', desc: true },
  ]);
  const [logs, setLogs] = useState<OtpLog[]>([]);

  useEffect(() => {
    setLogs(getAllOtpLogs());
  }, []);

  const purposes = useMemo(() => otpLogTemplates(logs), [logs]);

  const filteredData = useMemo(() => {
    let rows = [...logs];
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          r.nomor.toLowerCase().includes(q) ||
          r.requestId.toLowerCase().includes(q) ||
          r.tujuan.toLowerCase().includes(q),
      );
    }
    if (selectedStatuses.length > 0) {
      rows = rows.filter((r) => selectedStatuses.includes(r.status));
    }
    if (selectedPurposes.length > 0) {
      rows = rows.filter((r) => selectedPurposes.includes(r.tujuan));
    }
    return rows;
  }, [logs, searchQuery, selectedStatuses, selectedPurposes]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of OTP_STATUSES) counts[s] = 0;
    for (const row of logs) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, [logs]);

  const purposeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of purposes) counts[p] = 0;
    for (const row of logs) counts[row.tujuan] = (counts[row.tujuan] ?? 0) + 1;
    return counts;
  }, [logs, purposes]);

  const columns = useMemo<ColumnDef<OtpLog>[]>(
    () => [
      {
        accessorKey: 'waktu',
        id: 'waktu',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colTime')} column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-foreground font-normal">{row.original.waktu}</span>
        ),
        size: 140,
        enableSorting: true,
        enableHiding: false,
      },
      {
        accessorKey: 'nomor',
        id: 'nomor',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colNumber')} column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-foreground font-medium">{row.original.nomor}</span>
        ),
        size: 180,
        enableSorting: true,
      },
      {
        accessorKey: 'tujuan',
        id: 'tujuan',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colPurpose')} column={column} />
        ),
        cell: ({ row }) => (
          <span className="text-foreground">{row.original.tujuan}</span>
        ),
        size: 140,
        enableSorting: true,
      },
      {
        accessorKey: 'status',
        id: 'status',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colStatus')} column={column} />
        ),
        cell: ({ row }) =>
          statusBadge(
            row.original.status,
            row.original.status === 'Failed'
              ? t('otp.logFailed')
              : t('otp.logSuccess'),
          ),
        size: 120,
        enableSorting: true,
      },
      {
        accessorKey: 'requestId',
        id: 'requestId',
        header: ({ column }) => (
          <DataGridColumnHeader title={t('otp.colRequestId')} column={column} />
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.requestId}
          </span>
        ),
        size: 160,
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
    state: { pagination, sorting },
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
      </CardToolbar>
    );
  };

  return (
    <DashboardShell
      title={t('otp.logsTitle')}
      subtitle={t('otp.logsSubtitle')}
    >
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
                    placeholder={t('otp.searchLogs')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination((p) => ({ ...p, pageIndex: 0 }));
                    }}
                    className="ps-9 w-56 sm:w-64"
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

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <Filter />
                      {t('otp.colStatus')}
                      {selectedStatuses.length > 0 && (
                        <Badge size="sm" variant="outline">
                          {selectedStatuses.length}
                        </Badge>
                      )}
                      <ChevronDown className="size-3.5 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-44 p-3" align="start">
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        {t('otp.colStatus')}
                      </div>
                      {OTP_STATUSES.map((status) => (
                        <div key={status} className="flex items-center gap-2.5">
                          <Checkbox
                            id={`status-${status}`}
                            checked={selectedStatuses.includes(status)}
                            onCheckedChange={(checked) =>
                              toggleFilter(
                                selectedStatuses,
                                setSelectedStatuses,
                                status,
                                checked === true,
                              )
                            }
                          />
                          <Label
                            htmlFor={`status-${status}`}
                            className="grow flex items-center justify-between font-normal gap-1.5"
                          >
                            {status === 'Failed'
                              ? t('otp.logFailed')
                              : t('otp.logSuccess')}
                            <span className="text-muted-foreground">
                              {statusCounts[status]}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline">
                      <Filter />
                      {t('otp.colPurpose')}
                      {selectedPurposes.length > 0 && (
                        <Badge size="sm" variant="outline">
                          {selectedPurposes.length}
                        </Badge>
                      )}
                      <ChevronDown className="size-3.5 opacity-60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-3" align="start">
                    <div className="space-y-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        {t('otp.colPurpose')}
                      </div>
                      {purposes.map((purpose) => (
                        <div key={purpose} className="flex items-center gap-2.5">
                          <Checkbox
                            id={`purpose-${purpose}`}
                            checked={selectedPurposes.includes(purpose)}
                            onCheckedChange={(checked) =>
                              toggleFilter(
                                selectedPurposes,
                                setSelectedPurposes,
                                purpose,
                                checked === true,
                              )
                            }
                          />
                          <Label
                            htmlFor={`purpose-${purpose}`}
                            className="grow flex items-center justify-between font-normal gap-1.5"
                          >
                            {purpose}
                            <span className="text-muted-foreground">
                              {purposeCounts[purpose]}
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
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
          <CardFooter>
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>
    </DashboardShell>
  );
}
