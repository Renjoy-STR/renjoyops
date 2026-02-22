import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCallback } from 'react';

/** Staff exclusions from leaderboard */
export function useStaffExclusions(enabled: boolean) {
  return useQuery({
    queryKey: ['lb-staff-exclusions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leaderboard_exclusions')
        .select('*')
        .order('excluded_at', { ascending: false });
      return data || [];
    },
    enabled,
  });
}

/** Review exclusions */
export function useReviewExclusions(enabled: boolean) {
  return useQuery({
    queryKey: ['lb-review-exclusions'],
    queryFn: async () => {
      const { data } = await supabase
        .from('review_exclusions')
        .select('*')
        .order('excluded_at', { ascending: false });
      return data || [];
    },
    enabled,
  });
}

/** Mutation helpers for exclusions */
export function useExclusionMutations() {
  const queryClient = useQueryClient();

  const invalidateExclusions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['lb-staff-exclusions'] });
    queryClient.invalidateQueries({ queryKey: ['lb-review-exclusions'] });
    queryClient.invalidateQueries({ queryKey: ['lb-rpc'] });
  }, [queryClient]);

  const excludeReview = useCallback(async (reviewId: string, assigneeId: string, reason: string) => {
    const { error } = await supabase.from('review_exclusions').insert({
      review_id: reviewId,
      assignee_id: assigneeId,
      reason,
      excluded_by: 'manager',
    });
    if (error) throw error;
    invalidateExclusions();
  }, [invalidateExclusions]);

  const restoreReview = useCallback(async (reviewId: string, assigneeId?: string) => {
    let query = supabase.from('review_exclusions').delete().eq('review_id', reviewId);
    if (assigneeId) query = query.eq('assignee_id', assigneeId);
    const { error } = await query;
    if (error) throw error;
    invalidateExclusions();
  }, [invalidateExclusions]);

  const excludeStaff = useCallback(async (assigneeId: number | string, assigneeName: string, reason: string) => {
    const { error } = await supabase.from('leaderboard_exclusions').insert({
      assignee_id: String(assigneeId),
      assignee_name: assigneeName,
      reason,
      excluded_by: 'manager',
    });
    if (error) throw error;
    invalidateExclusions();
  }, [invalidateExclusions]);

  const restoreStaff = useCallback(async (assigneeId: number | string) => {
    const { error } = await supabase.from('leaderboard_exclusions').delete().eq('assignee_id', String(assigneeId));
    if (error) throw error;
    invalidateExclusions();
  }, [invalidateExclusions]);

  return { excludeReview, restoreReview, excludeStaff, restoreStaff };
}
