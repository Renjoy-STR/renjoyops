import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiDevice {
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

export interface UnifiSite {
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

export interface StatusRecord {
  id: string;
  device_id: string;
  status: string;
  recorded_at: string;
}

export function useUnifiDevices() {
  return useQuery({
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
}

export function useUnifiSites() {
  return useQuery({
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
}

export function useDeviceStatusLog(deviceId: string | null) {
  return useQuery({
    queryKey: ['unifi-device-status-log', deviceId],
    queryFn: async () => {
      if (!deviceId) return [];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('unifi_device_status_log')
        .select('*')
        .eq('device_id', deviceId)
        .gte('recorded_at', thirtyDaysAgo)
        .order('recorded_at', { ascending: true });
      if (error) throw error;
      return data as StatusRecord[];
    },
    enabled: !!deviceId,
  });
}

export function useAllDeviceStatusLogs(deviceIds: string[]) {
  return useQuery({
    queryKey: ['unifi-all-status-logs', deviceIds.sort().join(',')],
    queryFn: async () => {
      if (deviceIds.length === 0) return {};
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('unifi_device_status_log')
        .select('device_id, status, recorded_at')
        .in('device_id', deviceIds)
        .gte('recorded_at', twentyFourHoursAgo)
        .order('recorded_at', { ascending: true });
      if (error) throw error;
      
      const grouped: Record<string, StatusRecord[]> = {};
      (data ?? []).forEach((r: any) => {
        if (!grouped[r.device_id]) grouped[r.device_id] = [];
        grouped[r.device_id].push(r);
      });
      return grouped;
    },
    enabled: deviceIds.length > 0,
  });
}

export function useRecentOutages() {
  return useQuery({
    queryKey: ['unifi-recent-outages'],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('unifi_device_status_log')
        .select('*')
        .eq('status', 'offline')
        .gte('recorded_at', sevenDaysAgo)
        .order('recorded_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as StatusRecord[];
    },
  });
}
