import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Reviews (all fields needed, paginated to avoid 1000 limit) ──
export function useAllReviews(from: string, to: string, platform?: string) {
  return useQuery({
    queryKey: ['guest-sat-reviews', from, to, platform],
    queryFn: async () => {
      let q = supabase
        .from('guesty_reviews')
        .select('id, listing_id, rating, cleanliness_rating, accuracy_rating, communication_rating, location_rating, checkin_rating, value_rating, comment, reviewer_name, created_at, platform, reply, replied_at, reservation_id')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false });
      if (platform && platform !== 'all') {
        q = q.eq('platform', platform);
      }
      const all: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await q.range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        page++;
      }
      return all;
    },
  });
}

// ── Property registry for name resolution ──
export function usePropertyRegistryMap() {
  return useQuery({
    queryKey: ['guest-sat-property-registry'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('property_registry')
        .select('property_name, guesty_listing_id, breezeway_property_id, bedrooms, owner_name, status')
        .not('guesty_listing_id', 'is', null);
      const map: Record<string, { name: string; bwId: string; bedrooms: number | null; ownerName: string | null }> = {};
      data?.forEach(p => {
        if (p.guesty_listing_id) {
          map[p.guesty_listing_id] = {
            name: p.property_name,
            bwId: p.breezeway_property_id || '',
            bedrooms: p.bedrooms,
            ownerName: p.owner_name,
          };
        }
      });
      return map;
    },
  });
}

// ── Low reviews (< 4 stars) with property name ──
export function useLowReviews(from: string, to: string, platform?: string) {
  return useQuery({
    queryKey: ['guest-sat-low-reviews', from, to, platform],
    queryFn: async () => {
      let q = supabase
        .from('guesty_reviews')
        .select('id, listing_id, rating, cleanliness_rating, accuracy_rating, communication_rating, checkin_rating, value_rating, comment, reviewer_name, created_at, platform, reply, replied_at')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('rating', 'is', null)
        .lt('rating', 4)
        .order('rating', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(50);
      if (platform && platform !== 'all') {
        q = q.eq('platform', platform);
      }
      const { data } = await q;
      return data ?? [];
    },
  });
}

// ── Cleaner quality directly from cleaner_ratings_mat (assignee_name now populated) ──
export function useCleanerQuality(from: string, to: string) {
  return useQuery({
    queryKey: ['guest-sat-cleaner-quality', from, to],
    queryFn: async () => {
      // Fetch all attributed reviews in date range (paginated)
      const all: any[] = [];
      let page = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('cleaner_ratings_mat')
          .select('review_id, assignee_name, overall_rating, cleanliness_rating, property_name, reviewed_at, attribution_status')
          .eq('attribution_status', 'attributed')
          .not('assignee_name', 'is', null)
          .gte('reviewed_at', from)
          .lte('reviewed_at', to)
          .range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        page++;
      }

      if (all.length === 0) return { cleaners: [], totalReviews: 0, attributedReviews: 0 };

      // Aggregate by cleaner
      const byName: Record<string, { ratings: number[]; cleanlinessRatings: number[]; properties: Set<string>; reviewIds: Set<string>; below4: number }> = {};
      all.forEach(r => {
        const name = r.assignee_name;
        if (!name) return;
        if (!byName[name]) byName[name] = { ratings: [], cleanlinessRatings: [], properties: new Set(), reviewIds: new Set(), below4: 0 };
        if (r.overall_rating) {
          byName[name].ratings.push(r.overall_rating);
          if (r.overall_rating < 4) byName[name].below4++;
        }
        if (r.cleanliness_rating) byName[name].cleanlinessRatings.push(r.cleanliness_rating);
        if (r.property_name) byName[name].properties.add(r.property_name);
        if (r.review_id) byName[name].reviewIds.add(r.review_id);
      });

      const cleaners = Object.entries(byName)
        .filter(([, v]) => v.reviewIds.size >= 3)
        .map(([name, v]) => ({
          name,
          avgRating: v.ratings.length > 0 ? Math.round((v.ratings.reduce((a, b) => a + b, 0) / v.ratings.length) * 100) / 100 : null,
          avgCleanliness: v.cleanlinessRatings.length > 0 ? Math.round((v.cleanlinessRatings.reduce((a, b) => a + b, 0) / v.cleanlinessRatings.length) * 100) / 100 : null,
          properties: v.properties.size,
          reviews: v.reviewIds.size,
          below4: v.below4,
        }))
        .sort((a, b) => (a.avgRating ?? 5) - (b.avgRating ?? 5)); // worst first by default

      // Get total review count for attribution coverage
      const { count: totalCount } = await supabase
        .from('cleaner_ratings_mat')
        .select('*', { count: 'exact', head: true })
        .gte('reviewed_at', from)
        .lte('reviewed_at', to);

      return {
        cleaners,
        totalReviews: totalCount ?? 0,
        attributedReviews: all.length,
      };
    },
  });
}

// ── Quality correlation: avg clean time vs avg rating per property ──
export function useQualityCorrelation(from: string, to: string) {
  return useQuery({
    queryKey: ['guest-sat-quality-correlation', from, to],
    queryFn: async () => {
      const { data: reviews } = await supabase
        .from('guesty_reviews')
        .select('listing_id, rating')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('rating', 'is', null)
        .not('listing_id', 'is', null);

      if (!reviews?.length) return [];

      const byListing: Record<string, number[]> = {};
      reviews.forEach(r => {
        if (!r.listing_id || !r.rating) return;
        if (!byListing[r.listing_id]) byListing[r.listing_id] = [];
        byListing[r.listing_id].push(r.rating);
      });

      const { data: registry } = await supabase
        .from('property_registry')
        .select('guesty_listing_id, property_name, breezeway_property_id')
        .not('guesty_listing_id', 'is', null);

      const regMap: Record<string, { name: string; bwPropId: string }> = {};
      registry?.forEach(r => {
        if (r.guesty_listing_id) {
          regMap[r.guesty_listing_id] = { name: r.property_name, bwPropId: r.breezeway_property_id || '' };
        }
      });

      // Paginate breezeway_tasks
      const allTasks: any[] = [];
      let page = 0;
      while (true) {
        const { data: tasks } = await supabase
          .from('breezeway_tasks')
          .select('reference_property_id, total_time_minutes')
          .eq('department', 'Housekeeping')
          .not('total_time_minutes', 'is', null)
          .gt('total_time_minutes', 5)
          .lt('total_time_minutes', 300) // cap at 300 to filter outliers
          .gte('finished_at', from)
          .lte('finished_at', to)
          .not('reference_property_id', 'is', null)
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (!tasks || tasks.length === 0) break;
        allTasks.push(...tasks);
        if (tasks.length < 1000) break;
        page++;
      }

      const cleanByGuesty: Record<string, number[]> = {};
      allTasks.forEach(t => {
        if (!t.reference_property_id || !t.total_time_minutes) return;
        if (!cleanByGuesty[t.reference_property_id]) cleanByGuesty[t.reference_property_id] = [];
        cleanByGuesty[t.reference_property_id].push(t.total_time_minutes);
      });

      return Object.entries(byListing)
        .filter(([lid, ratings]) => ratings.length >= 3 && cleanByGuesty[lid]?.length)
        .map(([lid, ratings]) => {
          const avgRating = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100;
          const cleanTimes = cleanByGuesty[lid];
          const avgClean = Math.round(cleanTimes.reduce((a, b) => a + b, 0) / cleanTimes.length);
          const reg = regMap[lid];
          return {
            name: reg?.name || lid.slice(0, 12),
            avgRating,
            avgCleanMinutes: Math.min(avgClean, 240), // cap at 240
            reviewCount: ratings.length,
          };
        })
        .filter(d => d.avgCleanMinutes <= 240);
    },
  });
}

// ── Weekly scorecard ──
export function useWeeklyScorecard() {
  return useQuery({
    queryKey: ['guest-sat-weekly-scorecard'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const now = new Date();
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(now.getDate() - 7);
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(now.getDate() - 14);

      const tw = thisWeekStart.toISOString();
      const lw = lastWeekStart.toISOString();
      const lwEnd = thisWeekStart.toISOString();
      const nowStr = now.toISOString();

      // This week reviews
      const { data: twReviews } = await supabase
        .from('guesty_reviews')
        .select('rating, cleanliness_rating, reply')
        .gte('created_at', tw)
        .lte('created_at', nowStr)
        .not('rating', 'is', null);

      // Last week reviews
      const { data: lwReviews } = await supabase
        .from('guesty_reviews')
        .select('rating, cleanliness_rating, reply')
        .gte('created_at', lw)
        .lt('created_at', lwEnd)
        .not('rating', 'is', null);

      const calc = (rows: any[] | null) => {
        if (!rows?.length) return { avg: 0, count: 0, below4: 0, fiveStarPct: 0, avgCleanliness: 0, unrepliedLow: 0 };
        const avg = rows.reduce((s, r) => s + r.rating, 0) / rows.length;
        const below4 = rows.filter(r => r.rating < 4).length;
        const fiveStarPct = Math.round((rows.filter(r => r.rating === 5).length / rows.length) * 1000) / 10;
        const cleanRows = rows.filter(r => r.cleanliness_rating != null);
        const avgClean = cleanRows.length > 0 ? cleanRows.reduce((s, r) => s + r.cleanliness_rating, 0) / cleanRows.length : 0;
        const unreplied = rows.filter(r => r.rating < 4 && !r.reply).length;
        return { avg: Math.round(avg * 100) / 100, count: rows.length, below4, fiveStarPct, avgCleanliness: Math.round(avgClean * 100) / 100, unrepliedLow: unreplied };
      };

      return { thisWeek: calc(twReviews), lastWeek: calc(lwReviews) };
    },
  });
}

// ── Unreplied low reviews count (last 30 days) ──
export function useUnrepliedCount() {
  return useQuery({
    queryKey: ['guest-sat-unreplied-count'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { count } = await supabase
        .from('guesty_reviews')
        .select('*', { count: 'exact', head: true })
        .lt('rating', 4)
        .is('reply', null)
        .gte('created_at', thirtyDaysAgo.toISOString());
      return count ?? 0;
    },
  });
}

// ── Attribution map: review_id -> assignee_name (for low reviews) ──
export function useReviewAttribution(from: string, to: string) {
  return useQuery({
    queryKey: ['guest-sat-review-attribution', from, to],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('cleaner_ratings_mat')
        .select('review_id, assignee_name, attribution_status')
        .eq('attribution_status', 'attributed')
        .not('assignee_name', 'is', null)
        .gte('reviewed_at', from)
        .lte('reviewed_at', to);
      const map: Record<string, string> = {};
      data?.forEach(r => {
        if (r.review_id && r.assignee_name) map[r.review_id] = r.assignee_name;
      });
      return map;
    },
  });
}
