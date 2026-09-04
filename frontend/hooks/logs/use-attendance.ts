import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getAttendanceSummary, manualCheckin } from '@/lib/api/logs'

export function useAttendanceSummary() {
  return useQuery({
    queryKey: ['logs', 'attendance', 'summary'],
    queryFn: getAttendanceSummary,
  })
}

export function useManualCheckin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => manualCheckin(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['logs', 'attendance'] })
    },
  })
}
