import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Wifi, WifiOff, Router, Target, AlertTriangle, Search, Users, CheckCircle2, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { UptimeBar, UptimePercentage } from '@/components/network/UptimeBar';
import {
  useUnifiDevices,
  useUnifiSites,
  useDeviceStatusLog,
  useAllDeviceStatusLogs,
  useRecentOutages,
  type UnifiDevice,
} from '@/hooks/useNetworkData';

const AP_TARGET = 150;

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

/** Check if a device name looks "unnamed" — matches or contains only the model name */
function isUnnamedDevice(name: string | null, model: string | null): boolean {
  if (!name || !model) return !name;
  const n = name.trim().toLowerCase();
  const m = model.trim().toLowerCase();
  // Exact match or name is just model with extra chars around it (no other real words)
  if (n === m) return true;
  // Remove the model from the name — if what's left is only non-alpha or very short, it's unnamed
  const remainder = n.replace(m, '').replace(/[^a-z]/g, '');
  return remainder.length < 3;
}

/** Check if a site name looks like a raw UniFi ID */
function isUnnamedSite(name: string | null): boolean {
  if (!name) return true;
  const n = name.trim();
  if (n === 'default') return true;
  // No spaces, under 15 chars, alphanumeric only
  return n.length < 15 && /^[a-z0-9]+$/i.test(n) && !/\s/.test(n);
}

type ViewMode = 'device' | 'property';

export default function NetworkWifi() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<UnifiDevice | null>(null);
  const [sortField, setSortField] = useState<keyof UnifiDevice>('status');
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('device');

  const { data: devices, isLoading: devicesLoading } = useUnifiDevices();
  const { data: sites, isLoading: sitesLoading } = useUnifiSites();
  const { data: statusLog } = useDeviceStatusLog(selectedDevice?.device_id ?? null);
  const { data: recentOutages } = useRecentOutages();

  const deviceIds = useMemo(() => (devices ?? []).map(d => d.device_id), [devices]);
  const { data: allStatusLogs } = useAllDeviceStatusLogs(deviceIds);

  // Stats — devices already filtered is_console=false in hook
  const totalAPs = devices?.length ?? 0;
  const onlineAPs = devices?.filter(d => d.status === 'online').length ?? 0;
  const offlineAPs = devices?.filter(d => d.status === 'offline').length ?? 0;
  const migrationPct = AP_TARGET > 0 ? Math.round((onlineAPs / AP_TARGET) * 100) : 0;

  const totalWifiClients = (sites ?? []).reduce((sum, s) => sum + (s.wifi_clients ?? 0), 0);
  const totalGuestClients = (sites ?? []).reduce((sum, s) => sum + (s.guest_clients ?? 0), 0);

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
    // Default sort: offline first, then alphabetical by name
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

  const handleStatClick = (filter: string) => {
    setStatusFilter(filter);
  };

  const SortHeader = ({ field, children }: { field: keyof UnifiDevice; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground"
      onClick={() => handleSort(field)}
    >
      {children} {sortField === field ? (sortAsc ? '↑' : '↓') : ''}
    </TableHead>
  );

  const recentOutagesList = useMemo(() => {
    if (!recentOutages || !devices) return [];
    const deviceMap = new Map(devices.map(d => [d.device_id, d.name]));
    const seen = new Set<string>();
    return recentOutages
      .filter(r => {
        if (seen.has(r.device_id)) return false;
        seen.add(r.device_id);
        return true;
      })
      .slice(0, 5)
      .map(r => ({
        ...r,
        deviceName: deviceMap.get(r.device_id) ?? r.device_id,
      }));
  }, [recentOutages, devices]);

  const isLoading = devicesLoading || sitesLoading;

  /** Render device name with unnamed detection */
  const renderDeviceName = (device: UnifiDevice) => {
    const unnamed = isUnnamedDevice(device.name, device.model);
    if (unnamed) {
      return (
        <span className="flex items-center gap-1.5">
          <span className="italic text-muted-foreground">{device.name || '—'}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-muted-foreground/30">unnamed</Badge>
        </span>
      );
    }
    return <span>{device.name ?? '—'}</span>;
  };

  /** Render site name with unnamed detection */
  const renderSiteName = (name: string | null, siteId: string) => {
    if (isUnnamedSite(name)) {
      return (
        <span className="flex items-center gap-1.5">
          <span className="italic text-muted-foreground">{name || siteId}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-muted-foreground/30">unnamed site</Badge>
        </span>
      );
    }
    return <span className="font-medium">{name}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header + View Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary font-[Figtree]">
            Network & WiFi
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            UniFi access point monitoring and migration tracking.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {(['device', 'property'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                viewMode === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {mode === 'device' ? 'Device View' : 'Property View'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards — Single row of 6 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total APs */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'all' ? 'ring-2 ring-muted-foreground/30' : ''
          }`}
          onClick={() => handleStatClick('all')}
        >
          <CardContent className="pt-6 pb-4 px-4">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted shrink-0"><Router className="h-5 w-5 text-muted-foreground" /></div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Total APs</p>
                  <p className="text-3xl font-bold">{totalAPs}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Online */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'online' ? 'ring-2 ring-[hsl(142,71%,45%)]' : ''
          }`}
          onClick={() => handleStatClick('online')}
        >
          <CardContent className="pt-6 pb-4 px-4">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[hsl(142,71%,45%,0.1)] shrink-0">
                  <Wifi className="h-5 w-5 text-[hsl(var(--success))]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Online</p>
                  <p className="text-3xl font-bold text-[hsl(var(--success))]">{onlineAPs}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Offline */}
        <Card
          className={`cursor-pointer transition-all hover:shadow-md ${
            statusFilter === 'offline' ? 'ring-2 ring-destructive' : ''
          }`}
          onClick={() => handleStatClick('offline')}
        >
          <CardContent className="pt-6 pb-4 px-4">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10 shrink-0">
                  <WifiOff className="h-5 w-5 text-destructive" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Offline</p>
                  <p className={`text-3xl font-bold ${offlineAPs > 0 ? 'text-destructive' : ''}`}>{offlineAPs}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Migration */}
        <Card>
          <CardContent className="pt-6 pb-4 px-4">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted shrink-0"><Target className="h-5 w-5 text-muted-foreground" /></div>
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

        {/* WiFi Clients */}
        <Card>
          <CardContent className="pt-6 pb-4 px-4">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent shrink-0">
                  <Wifi className="h-5 w-5 text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">WiFi Clients</p>
                  <p className="text-3xl font-bold">{totalWifiClients}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Guest Clients */}
        <Card>
          <CardContent className="pt-6 pb-4 px-4">
            {isLoading ? <Skeleton className="h-12 w-full" /> : (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent shrink-0">
                  <Users className="h-5 w-5 text-secondary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">Guest Clients</p>
                  <p className="text-3xl font-bold">{totalGuestClients}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Property View Placeholder */}
      {viewMode === 'property' ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Router className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Property View — Coming Soon</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              View WiFi status grouped by property once property matching is complete.
              Each property will show its AP(s), uptime bars, and connected devices.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Device View — Main content */
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
                        {val === 'all' ? `All (${totalAPs})` : val === 'online' ? `Online (${onlineAPs})` : `Offline (${offlineAPs})`}
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
                      <TableHead className="w-[120px]">24h Uptime</TableHead>
                      <SortHeader field="last_synced_at">Last Synced</SortHeader>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDevices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No devices found.
                        </TableCell>
                      </TableRow>
                    ) : filteredDevices.map(device => (
                      <TableRow
                        key={device.id}
                        className={`cursor-pointer ${device.status === 'offline' ? 'bg-[hsl(0,85%,97%)] dark:bg-destructive/10' : ''}`}
                        onClick={() => setSelectedDevice(device)}
                      >
                        <TableCell className="font-medium">{renderDeviceName(device)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: device.status === 'online' ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
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
                        <TableCell>
                          <div className="w-[100px]">
                            <UptimeBar
                              records={allStatusLogs?.[device.device_id] ?? []}
                              height={4}
                            />
                          </div>
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
                  <CardTitle className="text-sm flex items-center gap-2 text-destructive">
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

            {/* Offline devices */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <WifiOff className="h-4 w-4 text-destructive" />
                  Offline Now ({offlineDevices.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                  </div>
                ) : offlineDevices.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                    <span className="text-muted-foreground">All devices online</span>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {offlineDevices.map(d => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 cursor-pointer hover:bg-muted/50 px-1 rounded"
                        onClick={() => setSelectedDevice(d)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-block h-2 w-2 rounded-full bg-destructive shrink-0" />
                          <span className="font-medium truncate">{d.name ?? d.device_id}</span>
                        </div>
                        <span className={`text-xs whitespace-nowrap ml-2 ${
                          d.last_synced_at && (Date.now() - new Date(d.last_synced_at).getTime()) > 60 * 60 * 1000
                            ? 'text-destructive font-bold'
                            : 'text-muted-foreground'
                        }`}>
                          {formatRelative(d.last_synced_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Outages */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Recent Outages (7d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentOutagesList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent outages</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {recentOutagesList.map(outage => (
                      <div key={outage.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                        <span className="font-medium truncate">{outage.deviceName}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {formatRelative(outage.recorded_at)}
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
                        <p className="text-sm">{renderSiteName(site.name, site.site_id)}</p>
                        {site.isp_name && (
                          <p className="text-xs text-muted-foreground">ISP: {site.isp_name}</p>
                        )}
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{site.total_devices ?? 0} devices</span>
                          {(site.offline_devices ?? 0) > 0 && (
                            <span className="text-destructive">{site.offline_devices} offline</span>
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
      )}

      {/* Device detail sheet */}
      <Sheet open={!!selectedDevice} onOpenChange={open => { if (!open) setSelectedDevice(null); }}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedDevice?.name ?? 'Device Details'}</SheetTitle>
          </SheetHeader>
          {selectedDevice && (
            <div className="mt-4 space-y-4 text-sm">
              {/* Last Seen */}
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Last Seen</span>
                <span className="font-medium">{formatRelative(selectedDevice.last_synced_at)}</span>
              </div>

              {/* Uptime History */}
              <div className="space-y-3 border rounded-lg p-3">
                <h4 className="text-sm font-semibold">Uptime History</h4>
                <UptimeBar records={statusLog ?? []} height={8} showLabels />
                <UptimePercentage records={statusLog ?? []} />
              </div>

              {/* Device Info */}
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
                          style={{ backgroundColor: value === 'online' ? 'hsl(var(--success))' : 'hsl(var(--destructive))' }}
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
