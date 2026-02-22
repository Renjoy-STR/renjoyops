import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Wifi, WifiOff, Router, Target, AlertTriangle, Search } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const AP_TARGET = 150;

interface UnifiDevice {
  id: string;
  device_id: string;
  site_id: string | null;
  mac_address: string | null;
  name: string | null;
  model: string | null;
  shortname: string | null;
  ip_address: string | null;
  status: string | null;
  firmware_version: string | null;
  firmware_status: string | null;
  is_console: boolean | null;
  is_managed: boolean | null;
  startup_time: string | null;
  adoption_time: string | null;
  note: string | null;
  property_id: string | null;
  last_synced_at: string | null;
}

interface UnifiSite {
  id: string;
  site_id: string;
  host_id: string;
  name: string | null;
  description: string | null;
  timezone: string | null;
  isp_name: string | null;
  isp_organization: string | null;
  total_devices: number | null;
  offline_devices: number | null;
  wifi_devices: number | null;
  wifi_clients: number | null;
  guest_clients: number | null;
  internet_issues: unknown;
  last_synced_at: string | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, h:mm a');
  } catch {
    return '—';
  }
}

function formatRelative(dateStr: string | null) {
  if (!dateStr) return '—';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '—';
  }
}

export default function NetworkWifi() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<UnifiDevice | null>(null);
  const [sortField, setSortField] = useState<keyof UnifiDevice>('status');
  const [sortAsc, setSortAsc] = useState(true);

  const { data: devices, isLoading: devicesLoading } = useQuery({
    queryKey: ['unifi-devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unifi_devices')
        .select('*')
        .eq('is_console', false)
        .order('name');
      if (error) throw error;
      return data as UnifiDevice[];
    },
  });

  const { data: sites, isLoading: sitesLoading } = useQuery({
    queryKey: ['unifi-sites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unifi_sites')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as UnifiSite[];
    },
  });

  const totalAPs = devices?.length ?? 0;
  const onlineAPs = devices?.filter(d => d.status === 'online').length ?? 0;
  const offlineAPs = devices?.filter(d => d.status === 'offline').length ?? 0;
  const migrationPct = Math.round((onlineAPs / AP_TARGET) * 100);

  const offlineDevices = useMemo(() =>
    (devices ?? [])
      .filter(d => d.status === 'offline')
      .sort((a, b) => (b.last_synced_at ?? '').localeCompare(a.last_synced_at ?? '')),
    [devices]
  );

  const sitesWithIssues = useMemo(() =>
    (sites ?? []).filter(s => {
      if (!s.internet_issues) return false;
      if (typeof s.internet_issues === 'object' && s.internet_issues !== null) {
        if (Array.isArray(s.internet_issues)) return (s.internet_issues as unknown[]).length > 0;
        return Object.keys(s.internet_issues as Record<string, unknown>).length > 0;
      }
      return false;
    }),
    [sites]
  );

  const filteredDevices = useMemo(() => {
    let list = devices ?? [];
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => (d.name ?? '').toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      if (sortField === 'status') {
        const aOffline = a.status === 'offline' ? 0 : 1;
        const bOffline = b.status === 'offline' ? 0 : 1;
        if (aOffline !== bOffline) return sortAsc ? aOffline - bOffline : bOffline - aOffline;
        return (a.name ?? '').localeCompare(b.name ?? '');
      }
      const aVal = (a[sortField] ?? '') as string;
      const bVal = (b[sortField] ?? '') as string;
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return list;
  }, [devices, statusFilter, search, sortField, sortAsc]);

  const handleSort = (field: keyof UnifiDevice) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const SortHeader = ({ field, children }: { field: keyof UnifiDevice; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {children} {sortField === field ? (sortAsc ? '↑' : '↓') : ''}
    </TableHead>
  );

  const isLoading = devicesLoading || sitesLoading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#F04C3B', fontFamily: 'Figtree, sans-serif' }}>
          Network & WiFi
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          UniFi access point monitoring and migration tracking.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted"><Router className="h-5 w-5 text-muted-foreground" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Total APs</p>
                  <p className="text-3xl font-bold">{totalAPs}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
                  <Wifi className="h-5 w-5" style={{ color: '#22C55E' }} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Online</p>
                  <p className="text-3xl font-bold" style={{ color: '#22C55E' }}>{onlineAPs}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
                  <WifiOff className="h-5 w-5" style={{ color: '#EF4444' }} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Offline</p>
                  <p className="text-3xl font-bold" style={{ color: offlineAPs > 0 ? '#EF4444' : undefined }}>{offlineAPs}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted"><Target className="h-5 w-5 text-muted-foreground" /></div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Migration</p>
                    <p className="text-xl font-bold">{migrationPct}%</p>
                  </div>
                </div>
                <Progress value={Math.min(migrationPct, 100)} className="h-2" />
                <p className="text-xs text-muted-foreground">{onlineAPs} / {AP_TARGET} target</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        {/* Left — device table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-base">Access Points</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 rounded-lg border p-0.5">
                  {(['all', 'online', 'offline'] as const).map(val => (
                    <button
                      key={val}
                      onClick={() => setStatusFilter(val)}
                      className={`px-3 py-1 text-xs font-medium rounded-md capitalize transition-colors ${
                        statusFilter === val
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {val === 'all' ? 'All' : val}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-9 h-9 w-[200px]"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader field="name">Name</SortHeader>
                    <SortHeader field="status">Status</SortHeader>
                    <SortHeader field="ip_address">IP Address</SortHeader>
                    <SortHeader field="model">Model</SortHeader>
                    <SortHeader field="firmware_status">Firmware</SortHeader>
                    <SortHeader field="last_synced_at">Last Synced</SortHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No devices found.
                      </TableCell>
                    </TableRow>
                  ) : filteredDevices.map(device => (
                    <TableRow
                      key={device.id}
                      className={`cursor-pointer ${device.status === 'offline' ? 'bg-[#FEF2F2] dark:bg-red-950/20' : ''}`}
                      onClick={() => setSelectedDevice(device)}
                    >
                      <TableCell className="font-medium">{device.name ?? '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: device.status === 'online' ? '#22C55E' : '#EF4444' }}
                          />
                          <span className="text-xs capitalize">{device.status ?? 'unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{device.ip_address ?? '—'}</TableCell>
                      <TableCell className="text-xs">{device.model ?? '—'}</TableCell>
                      <TableCell>
                        {device.firmware_status ? (
                          <Badge
                            variant={device.firmware_status === 'upToDate' ? 'secondary' : 'outline'}
                            className="text-xs"
                          >
                            {device.firmware_status === 'upToDate' ? 'Up to date' : device.firmware_status}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(device.last_synced_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          {/* Internet Issues Alert */}
          {sitesWithIssues.length > 0 && (
            <Card className="border-destructive">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2" style={{ color: '#EF4444' }}>
                  <AlertTriangle className="h-4 w-4" /> Internet Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                {sitesWithIssues.map(site => (
                  <div key={site.id} className="text-sm">
                    <span className="font-medium">{site.name}</span>
                    <pre className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                      {JSON.stringify(site.internet_issues, null, 2)}
                    </pre>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Offline devices alert */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <WifiOff className="h-4 w-4" style={{ color: '#EF4444' }} />
                Offline Devices ({offlineDevices.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                </div>
              ) : offlineDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground">All devices online</p>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {offlineDevices.map(d => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between text-sm py-1 border-b last:border-0 cursor-pointer hover:bg-muted/50 px-1 rounded"
                      onClick={() => setSelectedDevice(d)}
                    >
                      <span className="font-medium truncate">{d.name ?? d.device_id}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {formatDate(d.last_synced_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sites summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Sites</CardTitle>
            </CardHeader>
            <CardContent>
              {sitesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : (sites ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No sites found</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {(sites ?? []).map(site => (
                    <div key={site.id} className="border rounded-lg p-3 space-y-1">
                      <p className="font-medium text-sm">{site.name ?? site.site_id}</p>
                      {site.isp_name && (
                        <p className="text-xs text-muted-foreground">ISP: {site.isp_name}</p>
                      )}
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{site.total_devices ?? 0} devices</span>
                        {(site.offline_devices ?? 0) > 0 && (
                          <span style={{ color: '#EF4444' }}>{site.offline_devices} offline</span>
                        )}
                        <span>{site.wifi_clients ?? 0} clients</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Device detail sheet */}
      <Sheet open={!!selectedDevice} onOpenChange={open => { if (!open) setSelectedDevice(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedDevice?.name ?? 'Device Details'}</SheetTitle>
          </SheetHeader>
          {selectedDevice && (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Last Seen</span>
                <span className="font-medium">{formatRelative(selectedDevice.last_synced_at)}</span>
              </div>
              {([
                ['Status', selectedDevice.status],
                ['Device ID', selectedDevice.device_id],
                ['MAC Address', selectedDevice.mac_address],
                ['IP Address', selectedDevice.ip_address],
                ['Model', selectedDevice.model],
                ['Shortname', selectedDevice.shortname],
                ['Firmware', selectedDevice.firmware_version],
                ['Firmware Status', selectedDevice.firmware_status],
                ['Managed', selectedDevice.is_managed ? 'Yes' : 'No'],
                ['Startup Time', formatDate(selectedDevice.startup_time)],
                ['Adoption Time', formatDate(selectedDevice.adoption_time)],
                ['Last Synced', formatDate(selectedDevice.last_synced_at)],
                ['Property ID', selectedDevice.property_id],
                ['Site ID', selectedDevice.site_id],
                ['Note', selectedDevice.note],
              ] as [string, string | null][]).map(([label, value]) => (
                <div key={label} className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-right max-w-[200px] truncate">
                    {label === 'Status' ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: value === 'online' ? '#22C55E' : '#EF4444' }}
                        />
                        <span className="capitalize">{value ?? 'unknown'}</span>
                      </div>
                    ) : value ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
