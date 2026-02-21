import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Leaderboard data via RPC — shared by HousekeepingLeaderboard and TVSlideshow */
export function useLeaderboard(from: string, to: string, workerType?: string, refreshKey = 0) {
  return useQuery({
    queryKey: ['lb-rpc', from, to, workerType, refreshKey],
    queryFn: async () => {
      const params: { p_start: string; p_end: string; p_worker_type?: string } = { p_start: from, p_end: to };
      if (workerType) params.p_worker_type = workerType;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const { data, error } = await supabase.rpc('get_leaderboard', params, { signal: controller.signal } as any);
        clearTimeout(timeout);
        if (error) { console.error('[RPC] get_leaderboard error:', error.message, params); throw error; }
        return data || [];
      } catch (e: any) {
        clearTimeout(timeout);
        console.error('[RPC] get_leaderboard failed:', e?.message, params);
        throw e;
      }
    },
    retry: 2,
    retryDelay: 2000,
  });
}

/** Inspector leaderboard via RPC */
export function useInspectorLeaderboard(from: string, to: string, refreshKey = 0) {
  return useQuery({
    queryKey: ['lb-rpc-inspectors', from, to, refreshKey],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_inspector_leaderboard', { p_start: from, p_end: to });
      if (error) { console.error('[RPC] get_inspector_leaderboard error:', error.message); throw error; }
      return (data || []).map((r: any) => ({
        assignee_name: r.inspector_name,
        assignee_id: r.inspector_id,
        total_cleans: r.total_inspections,
        avg_minutes: 0,
        avg_cleanliness: r.avg_cleanliness,
        avg_overall: r.avg_overall,
        rated_cleans: r.rated_inspections,
        cleanliness_rated_cleans: r.cleanliness_rated,
        efficiency_pct: null,
        has_timeero: false,
        has_ratings: (r.cleanliness_rated || 0) >= 1,
        last_clean_date: null,
        worker_type: 'inspector',
        bad_reviews: r.bad_reviews,
        perfect_reviews: r.perfect_reviews,
      }));
    },
    retry: 2,
    retryDelay: 2000,
  });
}

/** Today's operational stats — shared by HousekeepingLeaderboard and TVSlideshow */
export function useTodayStats(date: string, refreshKey = 0) {
  return useQuery({
    queryKey: ['lb-today-stats', refreshKey, date],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_today_stats', { p_date: date });
      return data?.[0] || { total_scheduled: 0, cleans_completed: 0, cleans_in_progress: 0, cleaners_active: 0, avg_completion_minutes: null, cleans_upcoming: 0 };
    },
  });
}

/** Today's task details via RPC */
export function useTodayTasks(date: string, enabled: boolean) {
  return useQuery({
    queryKey: ['lb-today-tasks', date],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_today_tasks', { p_date: date });
      return data || [];
    },
    enabled,
  });
}

/** Clean streaks — shared by HousekeepingLeaderboard and TVSlideshow */
export function useCleanStreaks(refreshKey = 0) {
  return useQuery({
    queryKey: ['lb-clean-streaks', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_clean_streaks');
      return data || [];
    },
  });
}

/** Spotlight reviews via get_cleanliness_shoutouts RPC — shared */
export function useCleanlinessShoutouts(sinceDate: string, refreshKey = 0) {
  return useQuery({
    queryKey: ['lb-spotlight-reviews', sinceDate, refreshKey],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_cleanliness_shoutouts', { since_date: sinceDate });
      return (data || []).map((r: any) => ({
        ...r,
        assignee_name: r.cleaner_names,
        assignee_id: null,
        review_date: r.reviewed_at,
        listing_name: r.property_name,
      }));
    },
  });
}

/** Weekly shoutouts — shared by HousekeepingLeaderboard and TVSlideshow */
export function useWeeklyShoutouts(refreshKey = 0) {
  return useQuery({
    queryKey: ['lb-weekly-shoutouts', refreshKey],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_weekly_shoutouts');
      return data || [];
    },
  });
}

/** Weekly efficiency view — shared by HousekeepingLeaderboard and TVSlideshow */
export function useWeeklyEfficiency(from: string, to: string, refreshKey = 0) {
  return useQuery({
    queryKey: ['lb-weekly-eff', from, to, refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('v_weekly_efficiency')
        .select('*')
        .gte('week_start', from)
        .lte('week_start', to)
        .order('week_start', { ascending: true });
      return data || [];
    },
  });
}

/** Cleaner ratings from materialized view — shared by HousekeepingLeaderboard and TVSlideshow */
export function useCleanerRatings(from: string, to: string, refreshKey = 0) {
  return useQuery({
    queryKey: ['lb-cleaner-ratings', from, to, refreshKey],
    queryFn: async () => {
      let allRows: { cleanliness_rating: number; reviewed_at: string }[] = [];
      let page = 0;
      const PAGE_SIZE = 5000;
      while (true) {
        const { data, error } = await supabase
          .from('cleaner_ratings_mat')
          .select('cleanliness_rating, reviewed_at')
          .not('cleanliness_rating', 'is', null)
          .not('reviewed_at', 'is', null)
          .gte('reviewed_at', `${from}T00:00:00`)
          .lte('reviewed_at', `${to}T23:59:59`)
          .eq('attribution_status', 'cleaner')
          .order('reviewed_at', { ascending: true })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error) { console.error('[CleanScoreTrend] Error:', error); break; }
        if (!data?.length) break;
        allRows = allRows.concat(data);
        if (data.length < PAGE_SIZE) break;
        page++;
      }
      return allRows;
    },
  });
}

/** Rating distribution from cleaner_ratings_mat */
export function useRatingDistribution(refreshKey = 0) {
  return useQuery({
    queryKey: ['lb-rating-dist', refreshKey],
    queryFn: async () => {
      const { data } = await supabase
        .from('cleaner_ratings_mat')
        .select('assignee_id, cleanliness_rating')
        .not('cleanliness_rating', 'is', null)
        .eq('attribution_status', 'cleaner');
      if (!data?.length) return [];
      const byAssignee = new Map<number, { five: number; four: number; three: number; two: number; one: number; total: number }>();
      data.forEach((r: any) => {
        const id = Number(r.assignee_id);
        if (!byAssignee.has(id)) byAssignee.set(id, { five: 0, four: 0, three: 0, two: 0, one: 0, total: 0 });
        const d = byAssignee.get(id)!;
        const rating = Number(r.cleanliness_rating);
        if (rating >= 4.5) d.five++;
        else if (rating >= 3.5) d.four++;
        else if (rating >= 2.5) d.three++;
        else if (rating >= 1.5) d.two++;
        else d.one++;
        d.total++;
      });
      return Array.from(byAssignee.entries()).map(([id, dist]) => ({
        assignee_id: id,
        five_star: dist.five,
        four_star: dist.four,
        three_star: dist.three,
        two_star: dist.two,
        one_star: dist.one,
        total_ratings: dist.total,
      }));
    },
  });
}

/** Cleaner detail via RPC */
export function useCleanerDetail(assigneeId: number | null, from: string, to: string) {
  return useQuery({
    queryKey: ['lb-cleaner-detail', assigneeId, from, to],
    queryFn: async () => {
      if (!assigneeId) return [];
      const numericId = Number(assigneeId);
      if (isNaN(numericId)) {
        console.error('[CleanerDetail] Invalid assignee_id:', assigneeId);
        return [];
      }
      const { data, error } = await supabase.rpc('get_cleaner_detail', {
        p_assignee_id: numericId,
        p_start: from,
        p_end: to,
      });
      if (error) {
        console.error('[CleanerDetail] RPC error:', error);
        throw error;
      }
      return data || [];
    },
    enabled: assigneeId != null,
    retry: 1,
  });
}
