export type Channel = 'Store' | 'Online'
export type CampaignScope = 'Regional' | 'National' | 'Global'
export type Recommendation = 'Invest' | 'Maintain' | 'Optimize' | 'Markdown' | 'Discontinue review'
export type ComparisonMode = 'previous-period' | 'previous-year'
export type GeographyLevel = 'Global' | 'Region' | 'Country' | 'Market'
export type Aggregation = 'week' | 'month' | 'quarter'
export type CampaignObjective = 'Awareness' | 'Consideration' | 'Conversion'

export interface Region {
  id: string
  name: string
}

export interface Country {
  id: string
  name: string
  regionId: string
  market: string
}

export interface CalendarEvent {
  id: string
  name: string
  month: number
  day: number
  liftFactor: number
}

export interface CustomerSegment {
  id: string
  name: string
  description: string
}

export interface DashboardMetadata {
  brand: string
  currency: string
  periodStart: string
  periodEnd: string
  lastRefreshed: string
  isSynthetic: boolean
  seed: number
}

export interface Product {
  id: string
  styleCode: string
  name: string
  category: string
  collection: string
  season: string
  launchDate: string
  status: 'Active' | 'Carryover' | 'Exit review'
  unitCost: number
  listPrice: number
  returnRisk: number
}

export interface SalesRecord {
  id: string
  date: string
  productId: string
  regionId: string
  countryId: string
  channel: Channel
  calendarEventId: string | null
  customerSegmentId: string
  orders: number
  grossSales: number
  discounts: number
  returnsValue: number
  unitsSold: number
  unitsReturned: number
  cogs: number
  sessions: number | null
  conversions: number | null
}

export interface InventoryRecord {
  id: string
  date: string
  productId: string
  regionId: string
  channel: Channel
  openingUnits: number
  receipts: number
  endingUnits: number
}

export interface Campaign {
  id: string
  name: string
  scope: CampaignScope
  regionIds: string[]
  countryIds: string[]
  productIds: string[]
  categoryIds: string[]
  startDate: string
  endDate: string
  spend: number
  objective: CampaignObjective
  channels: Channel[]
}

export interface CampaignPerformance {
  campaignId: string
  regionId: string
  productId: string
  baselineSales: number
  observedSales: number
  attributedSales: number
  incrementalSales: number
  incrementalCogs: number
  conversionRateBaseline: number
  conversionRateCampaign: number
}

export interface DashboardTarget {
  id: string
  label: string
  value: number
  format: 'percent' | 'currency' | 'weeks'
}

export interface RecommendationConfig {
  investScore: number
  maintainScore: number
  optimizeScore: number
  investGrossMargin: number
  markdownWeeksSupply: number
  markdownSellThrough: number
  inventoryWeeksTarget: number
}

export interface DashboardData {
  metadata: DashboardMetadata
  dimensions: {
    regions: Region[]
    countries: Country[]
    channels: Channel[]
    categories: string[]
    seasons: string[]
    calendarEvents: CalendarEvent[]
    customerSegments: CustomerSegment[]
  }
  products: Product[]
  sales: SalesRecord[]
  inventory: InventoryRecord[]
  campaigns: Campaign[]
  campaignPerformance: CampaignPerformance[]
  targets: DashboardTarget[]
  recommendationConfig: RecommendationConfig
}

export interface DashboardFilters {
  dateRange: [string, string]
  comparison: ComparisonMode
  geographyLevel: GeographyLevel
  regionIds: string[]
  countryIds: string[]
  marketNames: string[]
  channel: 'All' | Channel
  categoryIds: string[]
  productIds: string[]
  seasons: string[]
  calendarEventIds: string[]
  campaignScope: 'All' | CampaignScope
  campaignIds: string[]
  customerSegmentIds: string[]
}

export interface ProductDecision {
  productId: string
  styleCode: string
  product: string
  category: string
  collection: string
  region: string
  season: string
  eventAffinity: string
  netSales: number
  units: number
  salesGrowthPct: number | null
  grossMarginPct: number | null
  sellThroughPct: number | null
  weeksOfSupply: number | null
  returnRatePct: number | null
  storeOnlineMix: string
  campaignSupport: string
  campaignRoas: number | null
  recommendation: Recommendation
  score: number | null
  confidence: 'High' | 'Medium' | 'Low'
  reasons: string[]
  risks: string[]
}

export interface KpiValue {
  current: number | null
  prior: number | null
  delta: number | null
  sparkline: number[]
}

export interface DashboardView {
  currentSales: SalesRecord[]
  previousSales: SalesRecord[]
  currentInventory: InventoryRecord[]
  previousInventory: InventoryRecord[]
  currentInventoryPeriod: InventoryRecord[]
  previousInventoryPeriod: InventoryRecord[]
  campaigns: Campaign[]
  campaignPerformance: CampaignPerformance[]
  decisions: ProductDecision[]
  kpis: {
    netSales: KpiValue
    unitsPurchased: KpiValue
    grossMarginPct: KpiValue
    sellThroughPct: KpiValue
    campaignRoas: KpiValue
    atRiskStyles: KpiValue
  }
  regions: Array<{ regionId: string; region: string; netSales: number; units: number; grossMarginPct: number | null; growthPct: number | null; storeShare: number; onlineShare: number }>
}
