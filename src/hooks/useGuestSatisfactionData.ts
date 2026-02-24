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
      // Fetch in pages to avoid 1000-row default limit
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
      const map: Record<string, { name: string; bwId: string; bedrooms: number | null }> = {};
      data?.forEach(p => {
        if (p.guesty_listing_id) {
          map[p.guesty_listing_id] = {
            name: p.property_name,
            bwId: p.breezeway_property_id || '',
            bedrooms: p.bedrooms,
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
        .select('id, listing_id, rating, comment, reviewer_name, created_at, platform, reply, replied_at')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('rating', 'is', null)
        .lt('rating', 4)
        .order('created_at', { ascending: false })
        .limit(30);
      if (platform && platform !== 'all') {
        q = q.eq('platform', platform);
      }
      const { data } = await q;
      return data ?? [];
    },
  });
}

// ── Cleaner quality from cleaner_ratings_mat + breezeway_task_assignments ──
export function useCleanerQuality(from: string, to: string) {
  return useQuery({
    queryKey: ['guest-sat-cleaner-quality', from, to],
    queryFn: async () => {
      // Get attributed reviews with clean_task_id in date range
      const { data: ratings } = await supabase
        .from('cleaner_ratings_mat')
        .select('review_id, clean_task_id, overall_rating, cleanliness_rating, property_name, reviewed_at, attribution_status')
        .eq('attribution_status', 'attributed')
        .not('clean_task_id', 'is', null)
        .gte('reviewed_at', from)
        .lte('reviewed_at', to);

      if (!ratings || ratings.length === 0) return { cleaners: [], totalReviews: 0, attributedReviews: 0 };

      // Get all task assignments for these task IDs
      const taskIds = [...new Set(ratings.map(r => r.clean_task_id).filter(Boolean))];
      
      // Fetch in batches
      const assignments: Record<number, string> = {};
      for (let i = 0; i < taskIds.length; i += 500) {
        const batch = taskIds.slice(i, i + 500);
        const { data: assigns } = await supabase
          .from('breezeway_task_assignments')
          .select('task_id, assignee_name')
          .in('task_id', batch)
          .not('assignee_name', 'is', null);
        assigns?.forEach(a => {
          if (a.task_id && a.assignee_name) assignments[a.task_id] = a.assignee_name;
        });
      }

      // Aggregate by cleaner
      const byName: Record<string, { ratings: number[]; cleanlinessRatings: number[]; properties: Set<string>; reviewIds: Set<string> }> = {};
      ratings.forEach(r => {
        const name = r.clean_task_id ? assignments[r.clean_task_id] : null;
        if (!name) return;
        if (!byName[name]) byName[name] = { ratings: [], cleanlinessRatings: [], properties: new Set(), reviewIds: new Set() };
        if (r.overall_rating) byName[name].ratings.push(r.overall_rating);
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
        }))
        .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));

      // Get total review count for attribution coverage
      const { count: totalCount } = await supabase
        .from('cleaner_ratings_mat')
        .select('*', { count: 'exact', head: true })
        .gte('reviewed_at', from)
        .lte('reviewed_at', to);

      return {
        cleaners,
        totalReviews: totalCount ?? 0,
        attributedReviews: ratings.length,
      };
    },
  });
}

// ── Quality correlation: avg clean time vs avg rating per property ──
export function useQualityCorrelation(from: string, to: string) {
  return useQuery({
    queryKey: ['guest-sat-quality-correlation', from, to],
    queryFn: async () => {
      // Get reviews grouped by listing
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

      // Get property registry for name + bw ID mapping
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

      // Get avg clean times from breezeway_tasks
      const { data: tasks } = await supabase
        .from('breezeway_tasks')
        .select('reference_property_id, total_time_minutes')
        .eq('department', 'housekeeping')
        .not('total_time_minutes', 'is', null)
        .gt('total_time_minutes', 5)
        .lt('total_time_minutes', 480)
        .gte('finished_at', from)
        .lte('finished_at', to)
        .not('reference_property_id', 'is', null);

      const cleanByGuesty: Record<string, number[]> = {};
      tasks?.forEach(t => {
        if (!t.reference_property_id || !t.total_time_minutes) return;
        if (!cleanByGuesty[t.reference_property_id]) cleanByGuesty[t.reference_property_id] = [];
        cleanByGuesty[t.reference_property_id].push(t.total_time_minutes);
      });

      // Combine
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
            avgCleanMinutes: avgClean,
            reviewCount: ratings.length,
          };
        });
    },
  });
}
