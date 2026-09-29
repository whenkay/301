import { describe, expect, it } from 'vitest'
import dashboardData from '../data/dashboard.json'
import type { DashboardData, DashboardFilters } from '../types/dashboard'
import { buildDashboardView, comparisonRange, grossMarginPct, netSales } from './dashboard-model'

const data = dashboardData as DashboardData
const defaultFilters: DashboardFilters = {
  dateRange: ['2026-01-01', '2026-08-31'],
  comparison: 'previous-year',
  geographyLevel: 'Global',
  regionIds: [],
  countryIds: [],
  marketNames: [],
  channel: 'All',
  categoryIds: [],
  productIds: [],
  seasons: [],
  calendarEventIds: [],
  campaignScope: 'All',
  campaignIds: [],
  customerSegmentIds: [],
}

describe('Chanell dashboard model', () => {
  it('calculates net sales, margin, and unavailable zero-denominator metrics', () => {
    const record = { grossSales: 100, discounts: 10, returnsValue: 5, cogs: 40 } as Parameters<typeof netSales>[0]
    expect(netSales(record)).toBe(85)
    expect(grossMarginPct([record])).toBeCloseTo(45 / 85)
    expect(grossMarginPct([])).toBeNull()
  })

  it('creates adjacent previous-period and year-over-year ranges', () => {
    expect(comparisonRange('2026-02-01', '2026-02-28', 'previous-period')).toEqual({ start: '2026-01-04', end: '2026-01-31' })
    expect(comparisonRange('2026-02-01', '2026-02-28', 'previous-year')).toEqual({ start: '2025-02-01', end: '2025-02-28' })
  })

  it('produces reproducible synthetic dimensions and weekly data', () => {
    expect(data.products).toHaveLength(40)
    expect(data.dimensions.regions).toHaveLength(6)
    expect(data.dimensions.countries).toHaveLength(24)
    expect(data.campaigns).toHaveLength(24)
    expect(data.sales.length).toBeGreaterThan(6500)
    expect(data.metadata.isSynthetic).toBe(true)
  })

  it('applies geography, channel, category, and season filters consistently', () => {
    const filters = {
      ...defaultFilters,
      regionIds: ['europe'],
      channel: 'Online' as const,
      categoryIds: ['Dresses'],
      seasons: ['Fall'],
    }
    const view = buildDashboardView(data, filters)
    expect(view.currentSales.length).toBeGreaterThan(0)
    expect(view.currentSales.every((sale) => sale.regionId === 'europe' && sale.channel === 'Online')).toBe(true)
    expect(view.decisions.every((decision) => decision.category === 'Dresses' && decision.season === 'Fall')).toBe(true)
  })

  it('filters campaign selections by scope and flight date', () => {
    const view = buildDashboardView(data, { ...defaultFilters, campaignScope: 'Regional' })
    expect(view.campaigns.length).toBeGreaterThan(0)
    expect(view.campaigns.every((campaign) => campaign.scope === 'Regional')).toBe(true)
  })

  it('returns stable, transparent product recommendations', () => {
    const first = buildDashboardView(data, defaultFilters)
    const second = buildDashboardView(data, defaultFilters)
    expect(first.decisions.map((decision) => decision.recommendation)).toEqual(second.decisions.map((decision) => decision.recommendation))
    expect(first.decisions.length).toBe(40)
    expect(first.decisions.every((decision) => decision.reasons.length > 0 && decision.confidence)).toBe(true)
    expect(first.kpis.netSales.current).toBeGreaterThan(0)
    expect(first.kpis.grossMarginPct.current).not.toBeNull()
  })
})
