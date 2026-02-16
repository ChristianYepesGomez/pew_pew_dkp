import { useQuery } from '@tanstack/react-query'
import { membersAPI, auctionsAPI, calendarAPI, bossesAPI, analyticsAPI, bisAPI, raidItemsAPI } from '../services/api'

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: () => membersAPI.getAll().then(r => r.data),
  })
}

export function useActiveAuctions() {
  return useQuery({
    queryKey: ['auctions', 'active'],
    queryFn: () => auctionsAPI.getActive().then(r => r.data),
  })
}

export function useAuctionHistory() {
  return useQuery({
    queryKey: ['auctions', 'history'],
    queryFn: () => auctionsAPI.getHistory().then(r => r.data),
  })
}

export function useCalendarSignups(weeks = 2) {
  return useQuery({
    queryKey: ['calendar', 'signups', weeks],
    queryFn: () => calendarAPI.getMySignups(weeks).then(r => r.data),
  })
}

export function useBosses() {
  return useQuery({
    queryKey: ['bosses'],
    queryFn: () => bossesAPI.getAll().then(r => r.data),
  })
}

export function useAnalytics(weeks = 8) {
  return useQuery({
    queryKey: ['analytics', weeks],
    queryFn: async () => {
      const [ecoRes, attRes, supRes, progRes, perfRes, insightsRes] = await Promise.all([
        analyticsAPI.getEconomy(),
        analyticsAPI.getAttendance(weeks),
        analyticsAPI.getSuperlatives(),
        analyticsAPI.getProgression(),
        analyticsAPI.getMyPerformance().catch(() => ({ data: null })),
        analyticsAPI.getGuildInsights().catch(() => ({ data: null })),
      ])
      return {
        economy: ecoRes.data,
        attendance: attRes.data,
        superlatives: supRes.data,
        progression: progRes.data,
        myPerformance: perfRes.data,
        guildInsights: insightsRes.data,
      }
    },
  })
}

export function useBisItemUsers(itemId) {
  return useQuery({
    queryKey: ['bis', 'itemUsers', itemId],
    queryFn: () => bisAPI.getItemUsers(itemId).then(r => r.data),
    enabled: !!itemId,
  })
}

export function useMyBis() {
  return useQuery({
    queryKey: ['bis', 'my'],
    queryFn: () => bisAPI.getMy().then(r => r.data),
  })
}

export function useRaidItems(enabled = true) {
  return useQuery({
    queryKey: ['raidItems'],
    queryFn: () => raidItemsAPI.getAll().then(r => r.data.items),
    staleTime: 60 * 60_000,
    gcTime: 2 * 60 * 60_000,
    enabled,
  })
}
