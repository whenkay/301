<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRaw, watch } from 'vue'
import { Bar, Bubble, Line } from 'vue-chartjs'
import type { ChartData, ChartOptions, Plugin } from 'chart.js'
import dashboardData from './data/dashboard.json'
import type {
  Aggregation,
  Campaign,
  Channel,
  DashboardData,
  DashboardFilters,
  DashboardView,
} from './types/dashboard'
import { aggregateByDate, buildDashboardView, netSales } from './utils/dashboard-model'

interface ActiveChip {
  key: string
  label: string
  values: string[]
}

interface CampaignRow {
  campaign: Campaign
  region: string
  promoted: string
  beforeSales: number
  duringSales: number
  afterSales: number
  attributedSales: number
  incrementalSales: number
  incrementalMargin: number
  roas: number | null
  conversionLift: number | null
  recommendation: 'Scale' | 'Optimize' | 'Retest' | 'Stop'
}

interface GeographyPoint {
  key: string
  label: string
  regionId: string | null
  countryId: string | null
  marketName: string | null
  netSales: number
  units: number
  grossMarginPct: number | null
  growthPct: number | null
  storeShare: number
  onlineShare: number
}

interface KpiCard {
  id: keyof DashboardView['kpis']
  label: string
  value: number | null
  prior: number | null
  delta: number | null
  share?: number | null
  unit: 'currency' | 'number' | 'percent' | 'basis-points' | 'ratio' | 'count'
  context: string
  sparkline: number[]
}

type ScatterPoint = { x: number; y: number; r: number; itemId: string; itemName: string }

const data = dashboardData as DashboardData
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: data.metadata.currency, maximumFractionDigits: 0 })
const compactCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: data.metadata.currency, notation: 'compact', maximumFractionDigits: 1 })
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const compactInteger = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const dateDisplay = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
const shortDate = (value: string) => dateDisplay.format(new Date(`${value}T00:00:00.000Z`))
const isoDate = (value: Date) => value.toISOString().slice(0, 10)

const filters = ref<DashboardFilters>({
  dateRange: ['2026-01-01', data.metadata.periodEnd],
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
})

const initialFilters: DashboardFilters = structuredClone(toRaw(filters.value))
const filtersOpen = ref(false)
const tabletFiltersOpen = ref(false)
const regionMetric = ref<'Net Sales' | 'Units' | 'Gross Margin' | 'YoY Growth'>('Net Sales')
const trendAggregation = ref<Aggregation>('month')
const trendChannel = ref<'All' | Channel>('All')
const normalizedTrend = ref(false)
const demandMode = ref<'Season' | 'Calendar event'>('Season')
const channelMetric = ref<'Sales share' | 'Units'>('Sales share')
const productSearch = ref('')
const campaignSearch = ref('')
const productSearchDebounced = ref('')
const productSort = ref<'score' | 'sales' | 'growth' | 'margin'>('score')
const methodologyOpen = ref(false)
const liveMessage = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined

watch(productSearch, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { productSearchDebounced.value = value }, 200)
})
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer) })

const view = computed(() => buildDashboardView(data, filters.value))
const regionMap = new Map(data.dimensions.regions.map((region) => [region.id, region.name]))
const countryMap = new Map(data.dimensions.countries.map((country) => [country.id, country.name]))
const productMap = new Map(data.products.map((product) => [product.id, product]))
const campaignMap = new Map(data.campaigns.map((campaign) => [campaign.id, campaign]))

const geographyRows = computed<GeographyPoint[]>(() => {
  const groups = new Map<string, { label: string; regionId: string | null; countryId: string | null; marketName: string | null; current: DashboardData['sales']; previous: DashboardData['sales'] }>()
  const addRows = (rows: DashboardData['sales'], period: 'current' | 'previous') => rows.forEach((sale) => {
    const country = data.dimensions.countries.find((item) => item.id === sale.countryId)
    const region = data.dimensions.regions.find((item) => item.id === sale.regionId)
    const key = filters.value.geographyLevel === 'Global' ? 'global'
      : filters.value.geographyLevel === 'Region' ? sale.regionId
        : filters.value.geographyLevel === 'Country' ? sale.countryId
          : country?.market ?? sale.countryId
    const label = filters.value.geographyLevel === 'Global' ? 'Global'
      : filters.value.geographyLevel === 'Region' ? region?.name ?? 'Region'
        : filters.value.geographyLevel === 'Country' ? country?.name ?? 'Country'
          : country?.market ?? 'Market'
    const group = groups.get(key) ?? { label, regionId: sale.regionId, countryId: filters.value.geographyLevel === 'Country' ? sale.countryId : null, marketName: filters.value.geographyLevel === 'Market' ? country?.market ?? null : null, current: [], previous: [] }
    group[period].push(sale)
    groups.set(key, group)
  })
  addRows(view.value.currentSales, 'current')
  addRows(view.value.previousSales, 'previous')
  return [...groups.entries()].map(([key, group]) => {
    const sales = group.current.reduce((total, sale) => total + netSales(sale), 0)
    const priorSales = group.previous.reduce((total, sale) => total + netSales(sale), 0)
    const storeSales = group.current.filter((sale) => sale.channel === 'Store').reduce((total, sale) => total + netSales(sale), 0)
    const onlineSales = group.current.filter((sale) => sale.channel === 'Online').reduce((total, sale) => total + netSales(sale), 0)
    const cogs = group.current.reduce((total, sale) => total + sale.cogs, 0)
    return {
      key,
      label: group.label,
      regionId: filters.value.geographyLevel === 'Region' ? group.regionId : null,
      countryId: filters.value.geographyLevel === 'Country' ? group.countryId : null,
      marketName: filters.value.geographyLevel === 'Market' ? group.marketName : null,
      netSales: sales,
      units: group.current.reduce((total, sale) => total + sale.unitsSold - sale.unitsReturned, 0),
      grossMarginPct: sales ? (sales - cogs) / sales : null,
      growthPct: priorSales ? (sales - priorSales) / priorSales : null,
      storeShare: sales ? storeSales / sales : 0,
      onlineShare: sales ? onlineSales / sales : 0,
    }
  }).sort((a, b) => b.netSales - a.netSales)
})

function matchesActiveDimensions(sale: DashboardData['sales'][number]) {
  const product = productMap.get(sale.productId)
  const country = data.dimensions.countries.find((item) => item.id === sale.countryId)
  if (!product || !country) return false
  if (filters.value.regionIds.length && !filters.value.regionIds.includes(sale.regionId)) return false
  if (filters.value.countryIds.length && !filters.value.countryIds.includes(sale.countryId)) return false
  if (filters.value.marketNames.length && !filters.value.marketNames.includes(country.market)) return false
  if (filters.value.channel !== 'All' && filters.value.channel !== sale.channel) return false
  if (filters.value.categoryIds.length && !filters.value.categoryIds.includes(product.category)) return false
  if (filters.value.productIds.length && !filters.value.productIds.includes(product.id)) return false
  if (filters.value.seasons.length && !filters.value.seasons.includes(product.season)) return false
  if (filters.value.calendarEventIds.length && (!sale.calendarEventId || !filters.value.calendarEventIds.includes(sale.calendarEventId))) return false
  if (filters.value.customerSegmentIds.length && !filters.value.customerSegmentIds.includes(sale.customerSegmentId)) return false
  return true
}

const globalFilters = computed(() => ({
  ...filters.value,
  regionIds: [],
  countryIds: [],
  marketNames: [],
  channel: 'All' as const,
  categoryIds: [],
  productIds: [],
  seasons: [],
  calendarEventIds: [],
  campaignScope: 'All' as const,
  campaignIds: [],
  customerSegmentIds: [],
}))
const globalView = computed(() => buildDashboardView(data, globalFilters.value))

function formatCurrency(value: number | null | undefined, compact = false) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Not available'
  return (compact ? compactCurrency : currency).format(value)
}

function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? 'Not available' : integer.format(value)
}

function formatCompact(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? 'Not available' : compactInteger.format(value)
}

function formatPercent(value: number | null | undefined, digits = 1) {
  return value === null || value === undefined || !Number.isFinite(value) ? 'Not available' : `${(value * 100).toFixed(digits)}%`
}

function formatSignedPercent(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? 'Not available' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`
}

function formatDelta(card: KpiCard) {
  if (card.delta === null) return 'Not available'
  if (card.unit === 'currency') return `${card.delta >= 0 ? '+' : ''}${formatCurrency(card.delta, true)}`
  if (card.unit === 'basis-points') return `${card.delta >= 0 ? '+' : ''}${Math.round(card.delta * 10_000)} bps`
  if (card.unit === 'ratio') return `${card.delta >= 0 ? '+' : ''}${card.delta.toFixed(2)}x`
  if (card.unit === 'count') return `${card.delta >= 0 ? '+' : ''}${integer.format(card.delta)} styles`
  if (card.unit === 'percent') return `${card.delta >= 0 ? '+' : ''}${(card.delta * 100).toFixed(1)}%`
  return `${card.delta >= 0 ? '+' : ''}${integer.format(card.delta)}`
}

const monthSnapshots = computed(() => {
  const end = new Date(`${filters.value.dateRange[1]}T00:00:00.000Z`)
  const snapshots: DashboardView[] = []
  for (let offset = 11; offset >= 0; offset -= 1) {
    const month = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - offset, 1))
    const monthStart = isoDate(month)
    const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0))
    const monthEnd = isoDate(lastDay) > filters.value.dateRange[1] ? filters.value.dateRange[1] : isoDate(lastDay)
    if (monthEnd < data.metadata.periodStart || monthStart > filters.value.dateRange[1]) {
      snapshots.push(buildDashboardView(data, { ...filters.value, dateRange: [monthStart, monthStart] }))
      continue
    }
    const boundedStart = monthStart < data.metadata.periodStart ? data.metadata.periodStart : monthStart
    snapshots.push(buildDashboardView(data, { ...filters.value, dateRange: [boundedStart, monthEnd] }))
  }
  return snapshots
})

const kpiCards = computed<KpiCard[]>(() => {
  const metrics = view.value.kpis
  const globalSales = globalView.value.kpis.netSales.current
  const share = metrics.netSales.current !== null && globalSales ? metrics.netSales.current / globalSales : null
  const atRiskCurrent = metrics.atRiskStyles.current
  const atRiskPrior = metrics.atRiskStyles.prior
  const getSparkline = (key: keyof DashboardView['kpis']) => monthSnapshots.value.map((snapshot) => snapshot.kpis[key].current ?? 0)
  return [
    { id: 'netSales', label: 'Net Sales', value: metrics.netSales.current, prior: metrics.netSales.prior, delta: metrics.netSales.delta, share, unit: 'currency', context: 'Filtered commercial result', sparkline: getSparkline('netSales') },
    { id: 'unitsPurchased', label: 'Units Purchased', value: metrics.unitsPurchased.current, prior: metrics.unitsPurchased.prior, delta: metrics.unitsPurchased.delta, unit: 'number', context: 'Completed units, net of returns', sparkline: getSparkline('unitsPurchased') },
    { id: 'grossMarginPct', label: 'Gross Margin', value: metrics.grossMarginPct.current, prior: metrics.grossMarginPct.prior, delta: metrics.grossMarginPct.delta, unit: 'basis-points', context: 'Net sales less cost of goods sold', sparkline: getSparkline('grossMarginPct') },
    { id: 'sellThroughPct', label: 'Sell-Through', value: metrics.sellThroughPct.current, prior: metrics.sellThroughPct.prior, delta: metrics.sellThroughPct.delta, unit: 'percent', context: 'Units sold / opening stock + receipts', sparkline: getSparkline('sellThroughPct') },
    { id: 'campaignRoas', label: 'Campaign ROAS', value: metrics.campaignRoas.current, prior: metrics.campaignRoas.prior, delta: metrics.campaignRoas.delta, unit: 'ratio', context: 'Attributed sales / campaign spend', sparkline: getSparkline('campaignRoas') },
    { id: 'atRiskStyles', label: 'At-Risk Styles', value: atRiskCurrent, prior: atRiskPrior, delta: metrics.atRiskStyles.delta, unit: 'count', context: 'Markdown or discontinuation review', sparkline: getSparkline('atRiskStyles') },
  ]
})

const activeChips = computed<ActiveChip[]>(() => {
  const chips: ActiveChip[] = []
  if (filters.value.dateRange[0] !== initialFilters.dateRange[0] || filters.value.dateRange[1] !== initialFilters.dateRange[1]) chips.push({ key: 'dateRange', label: 'Period', values: [`${filters.value.dateRange[0]} – ${filters.value.dateRange[1]}`] })
  if (filters.value.comparison !== initialFilters.comparison) chips.push({ key: 'comparison', label: 'Compare', values: [filters.value.comparison === 'previous-year' ? 'Previous year' : 'Previous period'] })
  if (filters.value.geographyLevel !== 'Global') chips.push({ key: 'geographyLevel', label: 'Geography', values: [filters.value.geographyLevel] })
  if (filters.value.regionIds.length) chips.push({ key: 'regionIds', label: 'Regions', values: filters.value.regionIds.map((id) => regionMap.get(id) ?? id) })
  if (filters.value.countryIds.length) chips.push({ key: 'countryIds', label: 'Countries', values: filters.value.countryIds.map((id) => countryMap.get(id) ?? id) })
  if (filters.value.marketNames.length) chips.push({ key: 'marketNames', label: 'Markets', values: [...filters.value.marketNames] })
  if (filters.value.channel !== 'All') chips.push({ key: 'channel', label: 'Channel', values: [filters.value.channel] })
  if (filters.value.categoryIds.length) chips.push({ key: 'categoryIds', label: 'Category', values: [...filters.value.categoryIds] })
  if (filters.value.productIds.length) chips.push({ key: 'productIds', label: 'Style', values: filters.value.productIds.map((id) => productMap.get(id)?.name ?? id) })
  if (filters.value.seasons.length) chips.push({ key: 'seasons', label: 'Season', values: [...filters.value.seasons] })
  if (filters.value.calendarEventIds.length) chips.push({ key: 'calendarEventIds', label: 'Event', values: filters.value.calendarEventIds.map((id) => data.dimensions.calendarEvents.find((event) => event.id === id)?.name ?? id) })
  if (filters.value.campaignScope !== 'All') chips.push({ key: 'campaignScope', label: 'Scope', values: [filters.value.campaignScope] })
  if (filters.value.campaignIds.length) chips.push({ key: 'campaignIds', label: 'Campaign', values: filters.value.campaignIds.map((id) => campaignMap.get(id)?.name ?? id) })
  if (filters.value.customerSegmentIds.length) chips.push({ key: 'customerSegmentIds', label: 'Segment', values: filters.value.customerSegmentIds.map((id) => data.dimensions.customerSegments.find((segment) => segment.id === id)?.name ?? id) })
  return chips
})

function removeChip(key: string) {
  switch (key) {
    case 'dateRange': filters.value.dateRange = [...initialFilters.dateRange]; break
    case 'comparison': filters.value.comparison = initialFilters.comparison; break
    case 'geographyLevel': filters.value.geographyLevel = 'Global'; break
    case 'regionIds': filters.value.regionIds = []; break
    case 'countryIds': filters.value.countryIds = []; break
    case 'marketNames': filters.value.marketNames = []; break
    case 'channel': filters.value.channel = 'All'; break
    case 'categoryIds': filters.value.categoryIds = []; break
    case 'productIds': filters.value.productIds = []; break
    case 'seasons': filters.value.seasons = []; break
    case 'calendarEventIds': filters.value.calendarEventIds = []; break
    case 'campaignScope': filters.value.campaignScope = 'All'; break
    case 'campaignIds': filters.value.campaignIds = []; break
    case 'customerSegmentIds': filters.value.customerSegmentIds = []; break
  }
}

function resetFilters() {
  filters.value = structuredClone(initialFilters)
  productSearch.value = ''
  campaignSearch.value = ''
}

const filteredDecisions = computed(() => {
  const query = productSearchDebounced.value.trim().toLowerCase()
  return view.value.decisions.filter((decision) => !query || [decision.product, decision.styleCode, decision.category, decision.collection, decision.region, decision.recommendation].some((value) => value.toLowerCase().includes(query)))
    .sort((a, b) => {
      if (productSort.value === 'sales') return b.netSales - a.netSales
      if (productSort.value === 'growth') return (b.salesGrowthPct ?? -Infinity) - (a.salesGrowthPct ?? -Infinity)
      if (productSort.value === 'margin') return (b.grossMarginPct ?? -Infinity) - (a.grossMarginPct ?? -Infinity)
      return (b.score ?? -1) - (a.score ?? -1)
    })
})

function setRegion(regionId: string) {
  filters.value.regionIds = filters.value.regionIds.includes(regionId) ? filters.value.regionIds.filter((id) => id !== regionId) : [...filters.value.regionIds, regionId]
  filters.value.geographyLevel = filters.value.regionIds.length ? 'Region' : 'Global'
}

function selectGeography(point: GeographyPoint) {
  if (point.regionId) setRegion(point.regionId)
  else if (point.countryId) {
    filters.value.countryIds = filters.value.countryIds.includes(point.countryId) ? filters.value.countryIds.filter((id) => id !== point.countryId) : [...filters.value.countryIds, point.countryId]
    filters.value.geographyLevel = filters.value.countryIds.length ? 'Country' : 'Global'
  } else if (point.marketName) {
    filters.value.marketNames = filters.value.marketNames.includes(point.marketName) ? filters.value.marketNames.filter((name) => name !== point.marketName) : [...filters.value.marketNames, point.marketName]
    filters.value.geographyLevel = filters.value.marketNames.length ? 'Market' : 'Global'
  }
}

function selectBubble() {
  // Drawer functionality removed
}

const regionalChartData = computed(() => ({
  labels: geographyRows.value.map((item) => item.label),
  datasets: [{
    label: regionMetric.value,
    data: geographyRows.value.map((item) => regionMetric.value === 'Net Sales' ? item.netSales : regionMetric.value === 'Units' ? item.units : regionMetric.value === 'Gross Margin' ? (item.grossMarginPct ?? 0) * 100 : (item.growthPct ?? 0) * 100),
    backgroundColor: '#050505',
    borderColor: '#050505',
    borderWidth: 1,
    borderRadius: 0,
    barThickness: 17,
  }],
}))

const regionalChartOptions: ChartOptions<'bar'> = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { display: false },
    tooltip: { callbacks: { label: (item) => {
      const value = item.parsed.x ?? 0
      return regionMetric.value === 'Net Sales' ? formatCurrency(value) : regionMetric.value.includes('Margin') || regionMetric.value.includes('Growth') ? `${value.toFixed(1)}%` : integer.format(value)
    } } },
  },
  scales: { x: { grid: { color: '#E8E8E5' }, ticks: { callback: (value) => regionMetric.value === 'Net Sales' ? formatCurrency(Number(value), true) : `${value}${regionMetric.value.includes('%') || regionMetric.value.includes('Margin') || regionMetric.value.includes('Growth') ? '%' : ''}` } }, y: { grid: { display: false } } },
  onClick: (_event, elements) => {
    const geography = geographyRows.value[elements[0]?.index ?? -1]
    if (geography) selectGeography(geography)
  },
}

const trendSeries = computed(() => {
  const channelFilter = (sale: DashboardData['sales'][number]) => trendChannel.value === 'All' || sale.channel === trendChannel.value
  const current = aggregateByDate(view.value.currentSales.filter(channelFilter), trendAggregation.value)
  const previous = aggregateByDate(view.value.previousSales.filter(channelFilter), trendAggregation.value)
  const labels = current.map((item) => item.period)
  const currentNet = current.map((item) => item.netSales)
  const priorNet = labels.map((_, index) => previous[index]?.netSales ?? null)
  const currentUnits = current.map((item) => item.units)
  if (!normalizedTrend.value) return { labels, netSales: currentNet, priorSales: priorNet, units: currentUnits }
  const normalized = (values: Array<number | null>) => {
    const baseline = values.find((value) => value !== null && value > 0)
    return values.map((value) => value === null || baseline === undefined || baseline === null ? null : value / baseline * 100)
  }
  return { labels, netSales: normalized(currentNet), priorSales: normalized(priorNet), units: normalized(currentUnits) }
})

const salesTrendData = computed(() => ({
  labels: trendSeries.value.labels,
  datasets: [
    { type: 'bar' as const, label: 'Units Purchased', data: trendSeries.value.units, backgroundColor: '#D8D8D4', borderColor: '#A0A0A0', yAxisID: 'yUnits' },
    { type: 'line' as const, label: 'Net Sales', data: trendSeries.value.netSales, borderColor: '#050505', backgroundColor: '#050505', pointBackgroundColor: '#050505', borderWidth: 2, tension: 0.22, yAxisID: 'ySales' },
    { type: 'line' as const, label: 'Prior Period Sales', data: trendSeries.value.priorSales, borderColor: '#666666', backgroundColor: 'transparent', pointBackgroundColor: '#FFFFFF', pointBorderColor: '#333333', borderDash: [6, 4], borderWidth: 1.5, tension: 0.22, yAxisID: 'ySales' },
  ],
}) as unknown as ChartData<'bar'>)

const trendOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: '#050505' } },
    tooltip: { backgroundColor: '#000000', titleColor: '#FFFFFF', bodyColor: '#FFFFFF', padding: 12, callbacks: { label: (item) => item.dataset.label?.includes('Sales') ? `${item.dataset.label}: ${normalizedTrend.value ? `${Number(item.raw).toFixed(0)} index` : formatCurrency(Number(item.raw))}` : `${item.dataset.label}: ${formatNumber(Number(item.raw))}` } },
  },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 10, color: '#333333' } },
    yUnits: { type: 'linear', position: 'left', grid: { color: '#E8E8E5' }, title: { display: true, text: normalizedTrend.value ? 'Index (100 = first period)' : 'Units' } },
    ySales: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: normalizedTrend.value ? 'Index (100 = first period)' : 'Net sales' }, ticks: { callback: (value) => normalizedTrend.value ? String(value) : formatCurrency(Number(value), true) } },
  },
}

const categoryScatterPoints = computed(() => view.value.decisions.map((decision) => ({
  x: (decision.salesGrowthPct ?? 0) * 100,
  y: (decision.grossMarginPct ?? 0) * 100,
  r: Math.max(5, Math.min(24, Math.sqrt(decision.netSales / Math.max(1, ...view.value.decisions.map((item) => item.netSales))) * 24)),
  itemId: decision.productId,
  itemName: decision.product,
  recommendation: decision.recommendation,
})))

const categoryBubbleData = computed(() => ({
  datasets: [
    { label: 'Invest', data: categoryScatterPoints.value.filter((point) => point.recommendation === 'Invest'), backgroundColor: '#050505', borderColor: '#050505', borderWidth: 1 },
    { label: 'Maintain', data: categoryScatterPoints.value.filter((point) => point.recommendation === 'Maintain'), backgroundColor: '#777777', borderColor: '#050505', borderWidth: 1 },
    { label: 'Optimize', data: categoryScatterPoints.value.filter((point) => point.recommendation === 'Optimize'), backgroundColor: '#FFFFFF', borderColor: '#333333', borderWidth: 2 },
    { label: 'Markdown', data: categoryScatterPoints.value.filter((point) => point.recommendation === 'Markdown' || point.recommendation === 'Discontinue review'), backgroundColor: '#E8E8E5', borderColor: '#050505', borderWidth: 1 },
  ],
}))

const categoryBubbleOptions: ChartOptions<'bubble'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: {
    legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: '#050505' } },
    tooltip: {
      backgroundColor: '#000000',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      callbacks: {
        title: (items) => (items[0]?.raw as { itemName?: string } | undefined)?.itemName ?? 'Apparel item',
        label: (item) => {
          const point = item.raw as ScatterPoint
          const decision = view.value.decisions.find((entry) => entry.productId === point.itemId)
          return decision ? [`Growth: ${formatSignedPercent(decision.salesGrowthPct)}`, `Margin: ${formatPercent(decision.grossMarginPct)}`, `Net sales: ${formatCurrency(decision.netSales)}`, decision.recommendation] : ''
        },
      },
    },
  },
  scales: {
    x: { title: { display: true, text: 'Sales growth vs comparison (%)' }, grid: { color: '#E8E8E5' } },
    y: { title: { display: true, text: 'Gross margin (%)' }, grid: { color: '#E8E8E5' } },
  },
  onClick: (_event, elements) => {
    const element = elements[0]
    if (!element) return
    const point = categoryBubbleData.value.datasets[element.datasetIndex]?.data[element.index] as ScatterPoint | undefined
    if (point?.itemId) selectBubble(point)
  },
}

const demandRows = computed(() => {
  const labels = demandMode.value === 'Season' ? data.dimensions.seasons : data.dimensions.calendarEvents.map((event) => event.name)
  return labels.map((label) => {
    const rows = view.value.currentSales.filter((sale) => {
      const product = productMap.get(sale.productId)
      if (demandMode.value === 'Season') return product?.season === label
      const event = data.dimensions.calendarEvents.find((item) => item.name === label)
      return sale.calendarEventId === event?.id
    })
    const revenue = rows.reduce((total, sale) => total + netSales(sale), 0)
    const units = rows.reduce((total, sale) => total + sale.unitsSold - sale.unitsReturned, 0)
    const margin = rows.reduce((total, sale) => total + netSales(sale) - sale.cogs, 0)
    const opening = view.value.currentInventory.filter((stock) => rows.some((sale) => sale.productId === stock.productId)).reduce((total, item) => total + item.openingUnits + item.receipts, 0)
    return { label, revenue, units, sellThrough: opening ? units / opening : null, margin: revenue ? margin / revenue : null }
  })
})

const demandChartData = computed(() => ({
  labels: demandRows.value.map((row) => row.label),
  datasets: [
    { label: 'Net Sales', data: demandRows.value.map((row) => row.revenue), backgroundColor: '#050505', borderColor: '#050505', borderWidth: 1 },
    { label: 'Prior Year', data: demandRows.value.map((row) => {
      const label = row.label
      const previousRows = view.value.previousSales.filter((sale) => {
        const product = productMap.get(sale.productId)
        return demandMode.value === 'Season' ? product?.season === label : sale.calendarEventId === data.dimensions.calendarEvents.find((event) => event.name === label)?.id
      })
      return previousRows.reduce((total, sale) => total + netSales(sale), 0)
    }), backgroundColor: '#D8D8D4', borderColor: '#555555', borderWidth: 1 },
  ],
}))

const demandOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: '#050505' } }, tooltip: { callbacks: { label: (item) => `${item.dataset.label}: ${formatCurrency(Number(item.raw))}` } } },
  scales: { x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 0 } }, y: { grid: { color: '#E8E8E5' }, ticks: { callback: (value) => formatCurrency(Number(value), true) } } },
}

const channelMixData = computed(() => ({
  labels: data.dimensions.categories,
  datasets: [
    { label: 'Store', data: data.dimensions.categories.map((category) => {
      const rows = view.value.currentSales.filter((sale) => sale.channel === 'Store' && productMap.get(sale.productId)?.category === category)
      return channelMetric.value === 'Units' ? rows.reduce((total, sale) => total + sale.unitsSold - sale.unitsReturned, 0) : rows.reduce((total, sale) => total + netSales(sale), 0)
    }), backgroundColor: '#050505' },
    { label: 'Online', data: data.dimensions.categories.map((category) => {
      const rows = view.value.currentSales.filter((sale) => sale.channel === 'Online' && productMap.get(sale.productId)?.category === category)
      return channelMetric.value === 'Units' ? rows.reduce((total, sale) => total + sale.unitsSold - sale.unitsReturned, 0) : rows.reduce((total, sale) => total + netSales(sale), 0)
    }), backgroundColor: '#A0A0A0' },
  ],
}))

const channelMixOptions: ChartOptions<'bar'> = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: '#050505' } }, tooltip: { callbacks: { label: (item) => channelMetric.value === 'Units' ? `${item.dataset.label}: ${formatNumber(Number(item.raw))}` : `${item.dataset.label}: ${formatCurrency(Number(item.raw))}` } } },
  scales: { x: { stacked: true, grid: { color: '#E8E8E5' }, ticks: { callback: (value) => channelMetric.value === 'Units' ? formatCompact(Number(value)) : formatCurrency(Number(value), true) } }, y: { stacked: true, grid: { display: false } } },
}

function campaignSales(campaign: Campaign, offset: 'before' | 'during' | 'after') {
  const start = new Date(`${campaign.startDate}T00:00:00.000Z`)
  const end = new Date(`${campaign.endDate}T00:00:00.000Z`)
  const windowStart = offset === 'before' ? isoDate(new Date(start.getTime() - 28 * 86_400_000)) : campaign.startDate
  const windowEnd = offset === 'before' ? isoDate(new Date(start.getTime() - 1 * 86_400_000)) : offset === 'during' ? campaign.endDate : isoDate(new Date(end.getTime() + 28 * 86_400_000))
  const actualStart = offset === 'after' ? isoDate(new Date(end.getTime() + 86_400_000)) : windowStart
  return data.sales.filter((sale) => sale.date >= actualStart && sale.date <= windowEnd)
    .filter(matchesActiveDimensions)
    .filter((sale) => campaign.productIds.includes(sale.productId) && campaign.regionIds.includes(sale.regionId) && campaign.channels.includes(sale.channel))
    .reduce((total, sale) => total + netSales(sale), 0)
}

const campaignRows = computed<CampaignRow[]>(() => view.value.campaigns.map((campaign) => {
  const results = data.campaignPerformance.filter((result) => result.campaignId === campaign.id)
  const attributedSales = results.reduce((total, result) => total + result.attributedSales, 0)
  const incrementalSales = results.reduce((total, result) => total + result.incrementalSales, 0)
  const incrementalCogs = results.reduce((total, result) => total + result.incrementalCogs, 0)
  const roas = campaign.spend > 0 ? attributedSales / campaign.spend : null
  const baselineConversion = results.length ? results.reduce((total, result) => total + result.conversionRateBaseline, 0) / results.length : null
  const campaignConversion = results.length ? results.reduce((total, result) => total + result.conversionRateCampaign, 0) / results.length : null
  const conversionLift = baselineConversion && campaignConversion !== null ? (campaignConversion - baselineConversion) / baselineConversion : null
  const incrementalMargin = incrementalSales - incrementalCogs - campaign.spend
  return {
    campaign,
    region: campaign.scope === 'Global' ? 'Global' : campaign.regionIds.map((id) => regionMap.get(id)).filter(Boolean).slice(0, 2).join(', '),
    promoted: campaign.categoryIds.join(', '),
    beforeSales: campaignSales(campaign, 'before'),
    duringSales: campaignSales(campaign, 'during'),
    afterSales: campaignSales(campaign, 'after'),
    attributedSales,
    incrementalSales,
    incrementalMargin,
    roas,
    conversionLift,
    recommendation: incrementalMargin > campaign.spend * 0.5 ? 'Scale' : incrementalMargin > 0 ? 'Optimize' : roas !== null && roas > 1 ? 'Retest' : 'Stop',
  }
}))

const filteredCampaignRows = computed(() => {
  const query = campaignSearch.value.trim().toLowerCase()
  return campaignRows.value.filter((row) => !query || [row.campaign.name, row.region, row.promoted, row.campaign.scope].some((value) => value.toLowerCase().includes(query)))
})

const campaignTimelineData = computed(() => ({
  labels: campaignRows.value.map((row) => row.campaign.name),
  datasets: [
    { label: 'Before flight', data: campaignRows.value.map((row) => row.beforeSales), borderColor: '#A0A0A0', backgroundColor: 'transparent', pointStyle: 'rect', borderDash: [3, 3], tension: 0.15 },
    { label: 'During flight', data: campaignRows.value.map((row) => row.duringSales), borderColor: '#050505', backgroundColor: '#050505', pointStyle: 'circle', tension: 0.15 },
    { label: 'After flight', data: campaignRows.value.map((row) => row.afterSales), borderColor: '#555555', backgroundColor: 'transparent', pointStyle: 'triangle', borderDash: [7, 4], tension: 0.15 },
  ],
}))

const campaignTimelineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: '#050505' } }, tooltip: { backgroundColor: '#000000', titleColor: '#FFFFFF', bodyColor: '#FFFFFF', callbacks: { label: (item) => `${item.dataset.label}: ${formatCurrency(Number(item.raw))}` } } },
  scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 35, minRotation: 0 } }, y: { grid: { color: '#E8E8E5' }, ticks: { callback: (value) => formatCurrency(Number(value), true) } } },
}

const campaignScatterData = computed(() => ({
  datasets: [
    { label: 'Regional', data: campaignRows.value.filter((row) => row.campaign.scope === 'Regional').map((row) => ({ x: row.campaign.spend, y: row.incrementalMargin, r: Math.max(5, Math.sqrt(row.attributedSales) / 20, 7), campaignId: row.campaign.id })), backgroundColor: '#A0A0A0', borderColor: '#050505', borderWidth: 1, pointStyle: 'circle' },
    { label: 'National', data: campaignRows.value.filter((row) => row.campaign.scope === 'National').map((row) => ({ x: row.campaign.spend, y: row.incrementalMargin, r: Math.max(5, Math.sqrt(row.attributedSales) / 20, 7), campaignId: row.campaign.id })), backgroundColor: '#FFFFFF', borderColor: '#050505', borderWidth: 2, pointStyle: 'rect' },
    { label: 'Global', data: campaignRows.value.filter((row) => row.campaign.scope === 'Global').map((row) => ({ x: row.campaign.spend, y: row.incrementalMargin, r: Math.max(5, Math.sqrt(row.attributedSales) / 20, 7), campaignId: row.campaign.id })), backgroundColor: '#050505', borderColor: '#050505', borderWidth: 1, pointStyle: 'triangle' },
  ],
}))

const campaignScatterOptions: ChartOptions<'bubble'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: '#050505' } }, tooltip: { backgroundColor: '#000000', titleColor: '#FFFFFF', bodyColor: '#FFFFFF', callbacks: { title: (items) => campaignRows.value.find((row) => row.campaign.id === (items[0]?.raw as { campaignId?: string }).campaignId)?.campaign.name ?? 'Campaign', label: (item) => [`Spend: ${formatCurrency(item.parsed.x)}`, `Incremental gross margin: ${formatCurrency(item.parsed.y)}`, 'Point size: attributed revenue'] } } },
  scales: { x: { title: { display: true, text: 'Campaign spend' }, grid: { color: '#E8E8E5' }, ticks: { callback: (value) => formatCurrency(Number(value), true) } }, y: { title: { display: true, text: 'Incremental gross margin · break-even at zero' }, grid: { color: '#E8E8E5' }, ticks: { callback: (value) => formatCurrency(Number(value), true) } } },
}

const zeroLinePlugin: Plugin<'bubble'> = {
  id: 'break-even-line',
  afterDraw(chart) {
    const yScale = chart.scales.y
    const yPixel = yScale?.getPixelForValue(0)
    if (yPixel === undefined || !chart.chartArea) return
    const { ctx, chartArea } = chart
    ctx.save()
    ctx.strokeStyle = '#050505'
    ctx.lineWidth = 1
    ctx.setLineDash([5, 4])
    ctx.beginPath()
    ctx.moveTo(chartArea.left, yPixel)
    ctx.lineTo(chartArea.right, yPixel)
    ctx.stroke()
    ctx.restore()
  },
}

const productHeaders = [
  { title: 'Rank', key: 'rank', sortable: false }, { title: 'Style', key: 'product' }, { title: 'Category', key: 'category' },
  { title: 'Collection', key: 'collection' }, { title: 'Region', key: 'region' }, { title: 'Season', key: 'season' },
  { title: 'Event affinity', key: 'eventAffinity' }, { title: 'Net sales', key: 'netSales' }, { title: 'Units', key: 'units' },
  { title: 'Sales growth', key: 'salesGrowthPct' }, { title: 'Gross margin', key: 'grossMarginPct' }, { title: 'Sell-through', key: 'sellThroughPct' },
  { title: 'Weeks of supply', key: 'weeksOfSupply' }, { title: 'Return rate', key: 'returnRatePct' }, { title: 'Store / online', key: 'storeOnlineMix' },
  { title: 'Campaign support', key: 'campaignSupport' }, { title: 'Campaign ROAS', key: 'campaignRoas' }, { title: 'Recommendation', key: 'recommendation' },
  { title: 'Confidence', key: 'confidence' }, { title: 'Key reason', key: 'reasons' },
]

const campaignHeaders = [
  { title: 'Campaign', key: 'campaign.name' }, { title: 'Scope', key: 'campaign.scope' }, { title: 'Market', key: 'region' },
  { title: 'Apparel promoted', key: 'promoted' }, { title: 'Flight dates', key: 'campaign.startDate' }, { title: 'Spend', key: 'campaign.spend' },
  { title: 'Attributed sales', key: 'attributedSales' }, { title: 'Incremental margin', key: 'incrementalMargin' },
  { title: 'ROAS', key: 'roas' }, { title: 'Conversion lift', key: 'conversionLift' }, { title: 'Recommendation', key: 'recommendation' },
]





function exportCsv() {
  const now = new Date()
  const timestamp = now.toISOString()
  const activeFilters = JSON.stringify(filters.value)
  const columns = ['Rank', 'Style code', 'Product', 'Category', 'Collection', 'Region', 'Season', 'Event affinity', 'Net sales', 'Units', 'Sales growth', 'Gross margin', 'Sell-through', 'Weeks of supply', 'Return rate', 'Store / online mix', 'Campaign support', 'Campaign ROAS', 'Recommendation', 'Confidence', 'Key reasons']
  const rows = filteredDecisions.value.map((decision, index) => [
    index + 1, decision.styleCode, decision.product, decision.category, decision.collection, decision.region, decision.season, decision.eventAffinity,
    decision.netSales, decision.units, decision.salesGrowthPct, decision.grossMarginPct, decision.sellThroughPct, decision.weeksOfSupply,
    decision.returnRatePct, decision.storeOnlineMix, decision.campaignSupport, decision.campaignRoas, decision.recommendation,
    decision.confidence, decision.reasons.join('; '),
  ])
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
  const csv = [`# CHANELL Global Apparel Performance`, `# Exported at ${timestamp}`, `# Filters ${activeFilters}`, columns.map(escape).join(','), ...rows.map((row) => row.map(escape).join(','))].join('\n')
  const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = `chanell-product-decisions-${isoDate(now)}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  showLiveMessage(`Exported ${rows.length} filtered product decisions.`)
}

const sparklineOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  plugins: { legend: { display: false }, tooltip: { enabled: false } },
  scales: { x: { display: false }, y: { display: false } },
  elements: { point: { radius: 0, hitRadius: 0 }, line: { borderWidth: 1.5, tension: 0.2 } },
}



function recommendationClass(recommendation: string) {
  return recommendation.toLowerCase().replaceAll(' ', '-')
}

function showLiveMessage(message: string) {
  liveMessage.value = message
  setTimeout(() => { liveMessage.value = '' }, 2600)
}


</script>

<template>
  <v-app>
    <v-layout class="app-layout">
      <header class="global-header">
        <div class="wordmark" aria-label="Chanell">CHANELL</div>
        <div class="header-rule"></div>
        <div class="header-context">
          <p>EXECUTIVE INTELLIGENCE / {{ filters.geographyLevel.toUpperCase() }}</p>
          <span>{{ data.metadata.periodStart }} — {{ data.metadata.periodEnd }}</span>
        </div>
        <button class="header-filter-button" aria-label="Open dashboard filters" :aria-expanded="filtersOpen || tabletFiltersOpen" @click="filtersOpen = !filtersOpen; tabletFiltersOpen = !tabletFiltersOpen">FILTERS <span>({{ activeChips.length }})</span></button>
        <button class="header-export" @click="exportCsv"><span aria-hidden="true">↓</span> EXPORT CSV</button>
      </header>

      <div class="dashboard-shell">
        <button v-if="filtersOpen" class="filter-backdrop" aria-label="Close filters" @click="filtersOpen = false"></button>
        <aside class="filter-rail" :class="{ 'filters-open': filtersOpen, 'tablet-open': tabletFiltersOpen }" aria-label="Executive filters">
          <div class="filter-rail-head">
            <div><span class="section-kicker">ANALYSIS PARAMETERS</span><h2>Filters</h2></div>
            <button class="filter-close" aria-label="Close filters" @click="filtersOpen = false; tabletFiltersOpen = false">×</button>
          </div>
          <form class="filter-form" @submit.prevent>
            <fieldset>
              <legend>Period</legend>
              <label class="field-label">Date range
                <div class="date-pair"><input v-model="filters.dateRange[0]" aria-label="Start date" type="date" :min="data.metadata.periodStart" :max="filters.dateRange[1]" /><input v-model="filters.dateRange[1]" aria-label="End date" type="date" :min="filters.dateRange[0]" :max="data.metadata.periodEnd" /></div>
              </label>
              <label class="field-label">Comparison<select v-model="filters.comparison"><option value="previous-year">Previous year</option><option value="previous-period">Previous period</option></select></label>
              <label class="field-label">Geography level<select v-model="filters.geographyLevel"><option>Global</option><option>Region</option><option>Country</option><option>Market</option></select></label>
            </fieldset>
            <fieldset>
              <legend>Geography and channel</legend>
              <label class="field-label">Region<select v-model="filters.regionIds" multiple size="3" @change="filters.geographyLevel = filters.regionIds.length ? 'Region' : 'Global'"><option v-for="region in data.dimensions.regions" :key="region.id" :value="region.id">{{ region.name }}</option></select></label>
              <label class="field-label">Country<select v-model="filters.countryIds" multiple size="4" @change="filters.geographyLevel = filters.countryIds.length ? 'Country' : 'Global'"><option v-for="country in data.dimensions.countries" :key="country.id" :value="country.id">{{ country.name }}</option></select></label>
              <label class="field-label">Market<select v-model="filters.marketNames" multiple size="3" @change="filters.geographyLevel = filters.marketNames.length ? 'Market' : 'Global'"><option v-for="market in [...new Set(data.dimensions.countries.map((country) => country.market))]" :key="market" :value="market">{{ market }}</option></select></label>
              <label class="field-label">Channel<select v-model="filters.channel"><option value="All">All channels</option><option value="Store">Stores</option><option value="Online">Online</option></select></label>
            </fieldset>
            <fieldset>
              <legend>Product</legend>
              <label class="field-label">Apparel category<select v-model="filters.categoryIds" multiple size="4"><option v-for="category in data.dimensions.categories" :key="category" :value="category">{{ category }}</option></select></label>
              <label class="field-label">Product / collection<select v-model="filters.productIds" multiple size="5"><option v-for="product in data.products" :key="product.id" :value="product.id">{{ product.name }} · {{ product.styleCode }}</option></select></label>
              <label class="field-label">Season<select v-model="filters.seasons" multiple size="4"><option v-for="season in data.dimensions.seasons" :key="season" :value="season">{{ season }}</option></select></label>
              <label class="field-label">Calendar event<select v-model="filters.calendarEventIds" multiple size="4"><option v-for="event in data.dimensions.calendarEvents" :key="event.id" :value="event.id">{{ event.name }}</option></select></label>
            </fieldset>
            <fieldset>
              <legend>Campaign and customer</legend>
              <label class="field-label">Campaign scope<select v-model="filters.campaignScope"><option value="All">All scopes</option><option value="Regional">Regional</option><option value="National">National</option><option value="Global">Global</option></select></label>
              <label class="field-label">Campaign<select v-model="filters.campaignIds" multiple size="5"><option v-for="campaign in data.campaigns" :key="campaign.id" :value="campaign.id">{{ campaign.name }}</option></select></label>
              <label class="field-label">Customer segment<select v-model="filters.customerSegmentIds" multiple size="4"><option v-for="segment in data.dimensions.customerSegments" :key="segment.id" :value="segment.id">{{ segment.name }}</option></select></label>
            </fieldset>
            <button class="reset-button" type="button" @click="resetFilters">RESET ALL FILTERS</button>
          </form>
        </aside>

        <main class="dashboard-main">
          <section class="page-intro">
            <div>
              <p class="section-kicker">GLOBAL COMMERCIAL REVIEW / {{ shortDate(data.metadata.periodEnd) }}</p>
              <h1>Global Apparel <em>Performance</em></h1>
              <p class="page-subtitle">Commercial intelligence for collection and campaign decisions</p>
            </div>
            <div class="refresh-note"><span class="refresh-dot"></span><span>LAST REFRESHED</span><strong>{{ shortDate(data.metadata.lastRefreshed.slice(0, 10)) }}</strong></div>
          </section>

          <section class="active-filters" aria-label="Active filters" aria-live="polite">
            <span class="active-label">ACTIVE VIEW</span>
            <template v-if="activeChips.length">
              <button v-for="chip in activeChips" :key="chip.key" class="filter-chip" :aria-label="`Remove ${chip.label} filter`" @click="removeChip(chip.key)"><span>{{ chip.label }}:</span> {{ chip.values.join(', ') }} <b>×</b></button>
            </template>
            <span v-else class="all-filters">All regions · All channels · All collections</span>
            <span class="result-count">{{ integer.format(view.decisions.length) }} STYLES</span>
          </section>

          <div class="filter-feedback" aria-live="polite">{{ liveMessage }}</div>

          <section class="kpi-strip" aria-label="Executive key performance indicators">
            <article v-for="(metric, index) in kpiCards" :key="metric.id" class="kpi-card">
              <div class="kpi-head"><span>{{ metric.label }}</span><button class="info-button" :aria-label="`${metric.label} definition`" :title="metric.context">i</button></div>
              <strong class="kpi-value">{{ metric.value === null ? 'Not available' : metric.unit === 'currency' ? formatCurrency(metric.value, true) : metric.unit === 'percent' ? formatPercent(metric.value) : metric.unit === 'basis-points' ? formatPercent(metric.value) : metric.unit === 'ratio' ? `${metric.value.toFixed(2)}x` : formatNumber(metric.value) }}</strong>
              <div class="kpi-context"><span :class="['kpi-delta', metric.delta === null ? 'neutral' : metric.id === 'atRiskStyles' ? (metric.delta <= 0 ? 'positive' : 'negative') : metric.delta >= 0 ? 'positive' : 'negative']">{{ formatDelta(metric) }}</span><span>{{ metric.unit === 'basis-points' ? 'CHANGE' : filters.comparison === 'previous-year' ? 'VS PRIOR YEAR' : 'VS PRIOR PERIOD' }}</span></div>
              <div class="kpi-sparkline"><Line v-if="metric.sparkline.length" :data="{ labels: metric.sparkline.map((_, point) => `${point + index}`), datasets: [{ data: metric.sparkline, borderColor: index === 5 ? '#8A6500' : '#050505', backgroundColor: index === 5 ? 'rgba(138,101,0,0.08)' : 'rgba(5,5,5,0.06)', fill: true }] }" :options="sparklineOptions" /></div>
              <div class="kpi-foot"><span>{{ metric.context }}</span><span v-if="metric.id === 'netSales' && metric.share !== null">{{ formatPercent(metric.share) }} OF GLOBAL</span></div>
            </article>
          </section>

          <section class="section-block overview-section">
            <div class="section-heading"><div><p class="section-kicker">01 / GLOBAL PERFORMANCE</p><h2>{{ filters.geographyLevel === 'Global' ? 'Global market performance' : `${filters.geographyLevel} performance` }}</h2></div><label class="inline-control">Measure<select v-model="regionMetric"><option>Net Sales</option><option>Units</option><option>Gross Margin</option><option>YoY Growth</option></select></label></div>
            <div class="overview-grid">
              <article class="editorial-panel region-panel">
                <div class="panel-heading"><div><h3>Regional ranking</h3><p>Select a bar to cross-filter the dashboard</p></div><span class="panel-index">01</span></div>
                <div class="chart-region ranking-chart"><Bar v-if="view.regions.length" :data="regionalChartData" :options="regionalChartOptions" /><p v-else class="empty-state">No regional records match this view.</p></div>
                <div class="channel-legend"><span><i class="legend-store"></i>STORE SHARE</span><span><i class="legend-online"></i>ONLINE SHARE</span></div>
                <div class="region-mix-list"><div v-for="place in geographyRows.slice(0, 4)" :key="place.key"><strong>{{ place.label }}</strong><span>Store {{ formatPercent(place.storeShare) }} / Online {{ formatPercent(place.onlineShare) }}</span><span>{{ formatSignedPercent(place.growthPct) }}</span></div></div>
              </article>
              <article class="editorial-panel trend-panel">
                <div class="panel-heading"><div><h3>Sales and purchasing trend</h3><p>Campaign-period annotations use synthetic flight dates</p></div><span class="panel-index">02</span></div>
                <div class="chart-controls"><label class="inline-control">Aggregation<select v-model="trendAggregation"><option value="week">Week</option><option value="month">Month</option><option value="quarter">Quarter</option></select></label><label class="inline-control">Channel<select v-model="trendChannel"><option value="All">Combined</option><option value="Store">Stores</option><option value="Online">Online</option></select></label><label class="check-control"><input v-model="normalizedTrend" type="checkbox" />Normalized index</label></div>
                <div class="chart-region trend-chart"><Bar v-if="trendSeries.labels.length" :data="salesTrendData" :options="trendOptions" /><p v-else class="empty-state">No sales match this period.</p></div>
                <div class="chart-summary">Bars show units purchased; solid line shows net sales; dashed line shows the selected comparison period.</div>
              </article>
            </div>
          </section>

          <section class="section-block">
            <div class="section-heading"><div><p class="section-kicker">02 / ASSORTMENT AND DEMAND</p><h2>Apparel and seasonal performance</h2></div></div>
            <div class="triple-grid">
              <article class="editorial-panel matrix-panel">
                <div class="panel-heading"><div><h3>Category performance matrix</h3><p>Each bubble is a style; size reflects net sales</p></div><span class="panel-index">03</span></div>
                <div class="quadrant-labels"><span>INVEST</span><span>PROTECT</span><span>IMPROVE</span><span>EXIT REVIEW</span></div>
                <div class="chart-region matrix-chart"><Bubble v-if="categoryScatterPoints.length" :data="categoryBubbleData" :options="categoryBubbleOptions" /><p v-else class="empty-state">No product data for this view.</p></div>
                <div class="chart-summary">Horizontal axis: sales growth. Vertical axis: gross margin. Focus on growth and margin together.</div>
              </article>
              <article class="editorial-panel demand-panel">
                <div class="panel-heading"><div><h3>Season and event demand</h3><p>Current versus prior year</p></div><span class="panel-index">04</span></div>
                <div class="segmented-control" role="group" aria-label="Demand view"><button :aria-pressed="demandMode === 'Season'" @click="demandMode = 'Season'">SEASON</button><button :aria-pressed="demandMode === 'Calendar event'" @click="demandMode = 'Calendar event'">CALENDAR EVENT</button></div>
                <div class="chart-region demand-chart"><Bar v-if="demandRows.length" :data="demandChartData" :options="demandOptions" /><p v-else class="empty-state">No seasonal demand for this selection.</p></div>
                <div class="season-summaries"><div v-for="row in demandRows.slice(0, 4)" :key="row.label"><span>{{ row.label }}</span><strong>{{ formatPercent(row.sellThrough) }}</strong></div></div>
              </article>
              <article class="editorial-panel channel-panel">
                <div class="panel-heading"><div><h3>Channel mix</h3><p>Store and online by category</p></div><span class="panel-index">05</span></div>
                <label class="inline-control">Metric<select v-model="channelMetric"><option>Sales share</option><option>Units</option></select></label>
                <div class="chart-region channel-chart"><Bar :data="channelMixData" :options="channelMixOptions" /></div>
                <div class="chart-summary">Black: stores. Gray: online. Use the channel filter to inspect either side of the business.</div>
              </article>
            </div>
          </section>

          <section class="section-block decision-section">
            <div class="section-heading"><div><p class="section-kicker">03 / PRODUCT DECISION CENTER</p><h2>Style decisions</h2><p class="section-description">Ranked on demand, margin, sell-through, inventory health, campaign efficiency, and returns.</p></div><div class="decision-controls"><label class="search-label"><span>SEARCH</span><input v-model="productSearch" type="search" placeholder="Style, collection, category" /></label><label class="inline-control">Rank by<select v-model="productSort"><option value="score">Decision score</option><option value="sales">Net sales</option><option value="growth">Sales growth</option><option value="margin">Gross margin</option></select></label></div></div>
            <div class="decision-table-wrap">
              <v-data-table :headers="productHeaders" :items="filteredDecisions" :items-per-page="15" item-value="productId" density="compact" class="decision-table">
                <template #item.rank="{ index }">{{ String(index + 1).padStart(2, '0') }}</template>
                <template #item.product="{ item }"><span class="table-product-label"><strong>{{ item.product }}</strong><small>{{ item.styleCode }}</small></span></template>
                <template #item.netSales="{ value }">{{ formatCurrency(value, true) }}</template>
                <template #item.units="{ value }">{{ formatNumber(value) }}</template>
                <template #item.salesGrowthPct="{ value }">{{ formatSignedPercent(value) }}</template>
                <template #item.grossMarginPct="{ value }">{{ formatPercent(value) }}</template>
                <template #item.sellThroughPct="{ value }">{{ formatPercent(value) }}</template>
                <template #item.weeksOfSupply="{ value }">{{ value === null ? 'Not available' : value.toFixed(1) }}</template>
                <template #item.returnRatePct="{ value }">{{ formatPercent(value) }}</template>
                <template #item.campaignRoas="{ value }">{{ value === null ? 'Not available' : `${value.toFixed(2)}x` }}</template>
                <template #item.recommendation="{ value }"><span :class="['recommendation-tag', recommendationClass(value)]">{{ value }}</span></template>
                <template #item.reasons="{ value }">{{ value[0] }}</template>
                <template #no-data><div class="empty-state">No products match these filters. <button @click="resetFilters">Reset filters</button></div></template>
              </v-data-table>
            </div>
            <div class="mobile-decisions" aria-label="Ranked style decisions">
              <div v-for="(decision, index) in filteredDecisions" :key="decision.productId" class="mobile-decision">
                <span class="mobile-rank">{{ String(index + 1).padStart(2, '0') }}</span><div class="mobile-decision-main"><div><small>{{ decision.styleCode }} / {{ decision.collection }}</small><h3>{{ decision.product }}</h3><span>{{ decision.category }} · {{ decision.region }}</span></div><span :class="['recommendation-tag', recommendationClass(decision.recommendation)]">{{ decision.recommendation }}</span></div>
                <div class="mobile-decision-metrics"><span><small>NET SALES</small>{{ formatCurrency(decision.netSales, true) }}</span><span><small>MARGIN</small>{{ formatPercent(decision.grossMarginPct) }}</span><span><small>SELL-THROUGH</small>{{ formatPercent(decision.sellThroughPct) }}</span></div>
                <p>{{ decision.reasons[0] }}</p>
              </div>
            </div>
            <div class="table-footnote">Synthetic local data · Recommendations are deterministic and should be treated as demo guidance.</div>
          </section>

          <section class="section-block campaigns-section">
            <div class="section-heading"><div><p class="section-kicker">04 / ADVERTISING EFFECTIVENESS</p><h2>Campaign performance</h2><p class="section-description">Campaign impact is an analytical estimate from synthetic comparison data; it does not establish causality.</p></div><label class="search-label campaign-search"><span>SEARCH</span><input v-model="campaignSearch" type="search" placeholder="Campaign, market, apparel" /></label></div>
            <div class="campaign-grid">
              <article class="editorial-panel"><div class="panel-heading"><div><h3>Campaign impact timeline</h3><p>Sales before, during, and after campaign flight</p></div><span class="panel-index">06</span></div><div class="chart-region campaign-timeline"><Line v-if="campaignRows.length" :data="campaignTimelineData" :options="campaignTimelineOptions" /><p v-else class="empty-state">No campaign results for this period.</p></div></article>
              <article class="editorial-panel"><div class="panel-heading"><div><h3>Investment portfolio</h3><p>Point size reflects attributed revenue · break-even at zero</p></div><span class="panel-index">07</span></div><div class="campaign-legend"><span>○ REGIONAL</span><span>□ NATIONAL</span><span>△ GLOBAL</span></div><div class="chart-region campaign-portfolio"><Bubble v-if="campaignRows.length" :data="campaignScatterData" :options="campaignScatterOptions" :plugins="[zeroLinePlugin]" /><p v-else class="empty-state">No campaign investment data for this period.</p></div></article>
            </div>
            <div class="campaign-table-wrap"><div class="table-section-heading"><h3>Campaign and apparel</h3><span>{{ filteredCampaignRows.length }} FLIGHTS</span></div><v-data-table :headers="campaignHeaders" :items="filteredCampaignRows" :items-per-page="8" item-value="campaign.id" density="compact" class="campaign-table">
              <template #item.campaign.name="{ item }"><span class="table-product-label"><strong>{{ item.campaign.name }}</strong></span></template>
              <template #item.campaign.startDate="{ item }">{{ shortDate(item.campaign.startDate) }} – {{ shortDate(item.campaign.endDate) }}</template>
              <template #item.campaign.spend="{ value }">{{ formatCurrency(value, true) }}</template>
              <template #item.attributedSales="{ value }">{{ formatCurrency(value, true) }}</template>
              <template #item.incrementalMargin="{ value }">{{ formatCurrency(value, true) }}</template>
              <template #item.roas="{ value }">{{ value === null ? 'Not available' : `${value.toFixed(2)}x` }}</template>
              <template #item.conversionLift="{ value }">{{ formatSignedPercent(value) }}</template>
              <template #no-data><div class="empty-state">No campaign flights match these filters.</div></template>
            </v-data-table></div>
          </section>

          <footer class="methodology-footer">
            <button class="methodology-toggle" :aria-expanded="methodologyOpen" @click="methodologyOpen = !methodologyOpen"><span>METHOD AND DATA NOTES</span><span>{{ methodologyOpen ? '−' : '+' }}</span></button>
            <div v-if="methodologyOpen" class="methodology-content"><p>All records are synthetic and loaded from local JSON. No external APIs or live customer data are connected.</p><p><strong>Metrics:</strong> Net sales = gross sales − discounts − returns. Gross margin = (net sales − COGS) / net sales. Sell-through = net units / (opening inventory + receipts). Weeks of supply = ending units / average weekly net units. ROAS = attributed sales / spend.</p><p><strong>Recommendations:</strong> Deterministic weighted indices combine sales growth (20%), gross margin (20%), sell-through (20%), inventory health (15%), campaign efficiency (15%), and return rate (10%). Demo thresholds are centralized in the local JSON.</p><p><strong>Campaign attribution:</strong> Incremental sales compare observed sales with a synthetic baseline; campaign associations are analytical estimates, not proof of causality. Currency: {{ data.metadata.currency }}. Last refresh: {{ shortDate(data.metadata.lastRefreshed.slice(0, 10)) }}.</p></div>
            <div class="footer-meta"><span>CHANELL / GLOBAL COMMERCIAL INTELLIGENCE</span><span>SYNTHETIC DATA · {{ data.metadata.seed }} SEED</span></div>
          </footer>
        </main>
      </div>


    </v-layout>
  </v-app>
</template>
