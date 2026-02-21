import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/** Guesty listing names + metadata — shared across BillingRevenue & GuestSatisfaction */
export function useGuestyListings() {
  return useQuery({
    queryKey: ['guesty-listings-all'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_listings')
        .select('id, nickname, title, bedrooms, accommodates');
      return data ?? [];
    },
  });
}

/** Build a name map from listings: id → display name */
export function useGuestyListingMap() {
  const { data: listings, ...rest } = useGuestyListings();
  const map: Record<string, { name: string; bedrooms: number }> = {};
  listings?.forEach(l => {
    map[l.id] = { name: l.nickname || l.title || l.id, bedrooms: l.bedrooms || 1 };
  });
  return { data: map, ...rest };
}

/** Guesty reservations within a date range */
export function useGuestyReservations(from: string, to: string) {
  return useQuery({
    queryKey: ['billing-revenue', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_reservations')
        .select('listing_id, fare_accommodation, host_payout, nights_count, check_in')
        .gte('check_in', from)
        .lte('check_in', to)
        .gt('fare_accommodation', 0);
      return data ?? [];
    },
  });
}

/** Guesty reviews within a date range */
export function useGuestyReviews(from: string, to: string) {
  return useQuery({
    queryKey: ['guest-reviews', from, to],
    queryFn: async () => {
      const { data } = await supabase
        .from('guesty_reviews')
        .select('id, listing_id, rating, cleanliness_rating, comment, reviewer_name, created_at, reservation_id, platform')
        .gte('created_at', from)
        .lte('created_at', to)
        .order('created_at', { ascending: false })
        .limit(2000);
      return data ?? [];
    },
  });
}

/** Occupancy data by listing (calendar + view) */
export function useOccupancyData(from: string, to: string) {
  return useQuery({
    queryKey: ['occupancy-data', from, to],
    queryFn: async () => {
      const { data: viewData } = await supabase
        .from('v_occupancy_by_listing')
        .select('listing_id, occupancy_rate, booked_days, total_days');

      const map: Record<string, { booked: number; total: number; rate: number }> = {};
      viewData?.forEach(v => {
        if (v.listing_id) {
          map[v.listing_id] = {
            booked: Number(v.booked_days) || 0,
            total: Number(v.total_days) || 1,
            rate: Number(v.occupancy_rate) || 0,
          };
        }
      });
      return map;
    },
  });
}
