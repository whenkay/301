import type {
  Aggregation,
  Campaign,
  CampaignPerformance,
  DashboardData,
  DashboardFilters,
  DashboardView,
  InventoryRecord,
  Product,
  ProductDecision,
  SalesRecord,
} from '../types/dashboard'

const dayMs = 86_400_000
const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value))
const toUtc = (date: string) => new Date(`${date}T00:00:00.000Z`)
const isoDate = (date: Date) => date.toISOString().slice(0, 10)
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals))
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

export function comparisonRange(start: string, end: string, mode: DashboardFilters['comparison']) {
  const startDate = toUtc(start)
  const endDate = toUtc(end)
  if (mode === 'previous-year') {
    const previousStart = new Date(startDate)
    const previousEnd = new Date(endDate)
    previousStart.setUTCFullYear(previousStart.getUTCFullYear() - 1)
    previousEnd.setUTCFullYear(previousEnd.getUTCFullYear() - 1)
    return { start: isoDate(previousStart), end: isoDate(previousEnd) }
  }
  const days = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / dayMs) + 1)
  return {
    start: isoDate(new Date(startDate.getTime() - days * dayMs)),
    end: isoDate(new Date(startDate.getTime() - dayMs)),
  }
}

function campaignMatches(sale: SalesRecord, campaigns: Campaign[]) {
  return campaigns.some((campaign) => sale.date >= campaign.startDate
    && sale.date <= campaign.endDate
    && campaign.productIds.includes(sale.productId)
    && campaign.regionIds.includes(sale.regionId)
    && campaign.channels.includes(sale.channel))
}

function matchesSalesDimensions(sale: SalesRecord, data: DashboardData, filters: DashboardFilters, campaigns: Campaign[]) {
  const country = data.dimensions.countries.find((item) => item.id === sale.countryId)
  const product = data.products.find((item) => item.id === sale.productId)
  if (!product || !country) return false
  if (filters.regionIds.length && !filters.regionIds.includes(sale.regionId)) return false
  if (filters.countryIds.length && !filters.countryIds.includes(sale.countryId)) return false
  if (filters.marketNames.length && !filters.marketNames.includes(country.market)) return false
  if (filters.channel !== 'All' && sale.channel !== filters.channel) return false
  if (filters.categoryIds.length && !filters.categoryIds.includes(product.category)) return false
  if (filters.productIds.length && !filters.productIds.includes(product.id)) return false
  if (filters.seasons.length && !filters.seasons.includes(product.season)) return false
  if (filters.calendarEventIds.length && (!sale.calendarEventId || !filters.calendarEventIds.includes(sale.calendarEventId))) return false
  if (filters.customerSegmentIds.length && !filters.customerSegmentIds.includes(sale.customerSegmentId)) return false
  if (filters.campaignScope !== 'All' && !campaigns.some((campaign) => campaign.scope === filters.campaignScope && campaignMatches(sale, [campaign]))) return false
  if (filters.campaignIds.length && !filters.campaignIds.some((id) => {
    const campaign = campaigns.find((item) => item.id === id)
    return Boolean(campaign && campaignMatches(sale, [campaign]))
  })) return false
  return true
}

function matchesInventoryDimensions(stock: InventoryRecord, data: DashboardData, filters: DashboardFilters) {
  const country = data.dimensions.countries.find((item) => item.regionId === stock.regionId)
  const product = data.products.find((item) => item.id === stock.productId)
  if (!product) return false
  if (filters.regionIds.length && !filters.regionIds.includes(stock.regionId)) return false
  if (filters.countryIds.length && (!country || !filters.countryIds.includes(country.id))) return false
  if (filters.marketNames.length && (!country || !filters.marketNames.includes(country.market))) return false
  if (filters.channel !== 'All' && stock.channel !== filters.channel) return false
  if (filters.categoryIds.length && !filters.categoryIds.includes(product.category)) return false
  if (filters.productIds.length && !filters.productIds.includes(product.id)) return false
  if (filters.seasons.length && !filters.seasons.includes(product.season)) return false
  return true
}

function currentInventorySnapshot(inventory: InventoryRecord[], data: DashboardData, filters: DashboardFilters, endDate: string) {
  const latestByKey = new Map<string, InventoryRecord>()
  const geographyScoped = filters.regionIds.length > 0 || filters.countryIds.length > 0 || filters.marketNames.length > 0
  inventory.filter((item) => item.date <= endDate && matchesInventoryDimensions(item, data, filters)).forEach((item) => {
    const key = geographyScoped
      ? `${item.productId}|${item.regionId}|${item.channel}`
      : `${item.productId}|${item.channel}`
    const current = latestByKey.get(key)
    if (!current || item.date > current.date) latestByKey.set(key, item)
  })
  return [...latestByKey.values()]
}

export function netSales(sale: SalesRecord) {
  return sale.grossSales - sale.discounts - sale.returnsValue
}

export function grossMarginPct(sales: SalesRecord[]) {
  const revenue = sum(sales.map(netSales))
  return revenue > 0 ? (revenue - sum(sales.map((sale) => sale.cogs))) / revenue : null
}

export function sellThroughPct(sales: SalesRecord[], inventory: InventoryRecord[]) {
  const sold = sum(sales.map((sale) => sale.unitsSold - sale.unitsReturned))
  const productWeekOpening = new Map<string, number>()
  const receipts = sum(inventory.map((item) => item.receipts))
  inventory.forEach((item) => {
    const key = `${item.productId}|${item.regionId}|${item.channel}`
    if (!productWeekOpening.has(key)) productWeekOpening.set(key, item.openingUnits)
  })
  const denominator = sum([...productWeekOpening.values()]) + receipts
  return denominator > 0 ? sold / denominator : null
}

function weeksOfSupply(productSales: SalesRecord[], stock: InventoryRecord[]) {
  const netUnits = sum(productSales.map((sale) => sale.unitsSold - sale.unitsReturned))
  const days = new Set(productSales.map((sale) => sale.date)).size * 7
  const weeklyUnits = days > 0 ? netUnits / (days / 7) : 0
  const ending = sum(stock.map((item) => item.endingUnits))
  return weeklyUnits > 0 ? ending / weeklyUnits : null
}

function normalizeGrowth(growthPct: number | null) {
  return growthPct === null ? 50 : clamp((growthPct + 20) / 60 * 100)
}

function normalizeMargin(margin: number | null) {
  return margin === null ? 0 : clamp(margin / 0.8 * 100)
}

function normalizeSellThrough(value: number | null) {
  return value === null ? 0 : clamp(value / 0.9 * 100)
}

function normalizeInventory(wos: number | null) {
  if (wos === null) return 0
  return clamp(100 - Math.abs(wos - 8) * 6)
}

function normalizeCampaign(roas: number | null) {
  return roas === null ? 50 : clamp(roas / 4 * 100)
}

function normalizeReturns(value: number | null) {
  return value === null ? 50 : clamp(100 - value * 4)
}

function getCampaignStats(productId: string, performances: CampaignPerformance[], campaigns: Campaign[]) {
  const matches = performances.filter((item) => item.productId === productId && campaigns.some((campaign) => campaign.id === item.campaignId))
  const campaignIds = new Set(matches.map((item) => item.campaignId))
  const spend = sum(campaigns.filter((campaign) => campaignIds.has(campaign.id)).map((campaign) => campaign.spend))
  const attributed = sum(matches.map((item) => item.attributedSales))
  return {
    matches,
    spend,
    attributed,
    roas: spend > 0 ? attributed / spend : null,
  }
}

function buildProductDecision(
  data: DashboardData,
  product: Product,
  currentSales: SalesRecord[],
  previousSales: SalesRecord[],
  inventory: InventoryRecord[],
  inventoryPeriod: InventoryRecord[],
  performances: CampaignPerformance[],
  campaigns: Campaign[],
): ProductDecision {
  const productCurrent = currentSales.filter((sale) => sale.productId === product.id)
  const productPrevious = previousSales.filter((sale) => sale.productId === product.id)
  const productStock = inventory.filter((item) => item.productId === product.id)
  const productStockPeriod = inventoryPeriod.filter((item) => item.productId === product.id)
  const currentRevenue = sum(productCurrent.map(netSales))
  const previousRevenue = sum(productPrevious.map(netSales))
  const growth = previousRevenue > 0 ? (currentRevenue - previousRevenue) / previousRevenue : null
  const margin = grossMarginPct(productCurrent)
  const sellThrough = sellThroughPct(productCurrent, productStockPeriod)
  const wos = weeksOfSupply(productCurrent, productStock)
  const shippedUnits = sum(productCurrent.map((sale) => sale.unitsSold))
  const returnedUnits = sum(productCurrent.map((sale) => sale.unitsReturned))
  const returnRate = shippedUnits > 0 ? returnedUnits / shippedUnits : null
  const storeRevenue = sum(productCurrent.filter((sale) => sale.channel === 'Store').map(netSales))
  const onlineRevenue = sum(productCurrent.filter((sale) => sale.channel === 'Online').map(netSales))
  const totalRevenue = storeRevenue + onlineRevenue
  const campaignStats = getCampaignStats(product.id, performances, campaigns)
  const score = totalRevenue > 0
    ? Math.round(
      normalizeGrowth(growth) * 0.20
      + normalizeMargin(margin) * 0.20
      + normalizeSellThrough(sellThrough) * 0.20
      + normalizeInventory(wos) * 0.15
      + normalizeCampaign(campaignStats.roas) * 0.15
      + normalizeReturns(returnRate) * 0.10,
    )
    : null
  const config = data.recommendationConfig
  let recommendation: ProductDecision['recommendation'] = 'Discontinue review'
  if (score !== null && score >= config.investScore && margin !== null && margin >= config.investGrossMargin) recommendation = 'Invest'
  else if (score !== null && score >= config.maintainScore) recommendation = 'Maintain'
  else if (score !== null && score >= config.optimizeScore) recommendation = 'Optimize'
  else if (wos !== null && sellThrough !== null && wos > config.markdownWeeksSupply && sellThrough < config.markdownSellThrough) recommendation = 'Markdown'

  const regions = data.dimensions.regions
  const dominantRegionId = productCurrent.reduce((totals, sale) => {
    totals.set(sale.regionId, (totals.get(sale.regionId) ?? 0) + netSales(sale))
    return totals
  }, new Map<string, number>())
  const dominantRegion = [...dominantRegionId.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const eventTotals = productCurrent.reduce((totals, sale) => {
    if (sale.calendarEventId) totals.set(sale.calendarEventId, (totals.get(sale.calendarEventId) ?? 0) + netSales(sale))
    return totals
  }, new Map<string, number>())
  const eventAffinity = [...eventTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const topEvent = data.dimensions.calendarEvents.find((event) => event.id === eventAffinity)?.name
  const reasons = [
    { score: normalizeGrowth(growth), text: growth === null ? 'No comparable sales period' : `Sales ${growth >= 0 ? 'grew' : 'declined'} ${Math.abs(round(growth * 100, 1))}% versus comparison` },
    { score: normalizeMargin(margin), text: margin === null ? 'Margin unavailable for this selection' : `Gross margin ${round(margin * 100, 1)}%` },
    { score: normalizeSellThrough(sellThrough), text: sellThrough === null ? 'Sell-through unavailable' : `Sell-through ${round(sellThrough * 100, 1)}%` },
    { score: normalizeInventory(wos), text: wos === null ? 'Inventory cover unavailable' : `${round(wos, 1)} weeks of supply` },
    { score: normalizeCampaign(campaignStats.roas), text: campaignStats.roas === null ? 'No attributed campaign data' : `Campaign ROAS ${round(campaignStats.roas, 2)}x` },
    { score: normalizeReturns(returnRate), text: returnRate === null ? 'Return rate unavailable' : `Return rate ${round(returnRate * 100, 1)}%` },
  ].sort((a, b) => b.score - a.score)
  const risks = [
    ...(wos !== null && wos > config.markdownWeeksSupply ? [`Weeks of supply is elevated at ${round(wos, 1)}`] : []),
    ...(margin !== null && margin < config.investGrossMargin ? [`Margin is below the ${round(config.investGrossMargin * 100)}% demo target`] : []),
    ...(growth !== null && growth < -0.1 ? [`Sales are down ${round(Math.abs(growth) * 100, 1)}% versus comparison`] : []),
    ...(returnRate !== null && returnRate > 0.15 ? [`Return rate is ${round(returnRate * 100, 1)}%`] : []),
  ].slice(0, 2)
  const confidence: ProductDecision['confidence'] = productCurrent.length >= 20 && productStock.length > 0 ? 'High' : productCurrent.length >= 8 ? 'Medium' : 'Low'

  return {
    productId: product.id,
    styleCode: product.styleCode,
    product: product.name,
    category: product.category,
    collection: product.collection,
    region: regions.find((region) => region.id === dominantRegion)?.name ?? 'Global',
    season: product.season,
    eventAffinity: topEvent ?? 'General assortment',
    netSales: currentRevenue,
    units: sum(productCurrent.map((sale) => sale.unitsSold - sale.unitsReturned)),
    salesGrowthPct: growth,
    grossMarginPct: margin,
    sellThroughPct: sellThrough,
    weeksOfSupply: wos,
    returnRatePct: returnRate,
    storeOnlineMix: totalRevenue > 0 ? `${round(storeRevenue / totalRevenue * 100)}% / ${round(onlineRevenue / totalRevenue * 100)}%` : 'Not available',
    campaignSupport: campaignStats.matches.length ? `${campaignStats.matches.length} flights` : 'No active support',
    campaignRoas: campaignStats.roas,
    recommendation,
    score,
    confidence,
    reasons: reasons.slice(0, 3).map((item) => item.text),
    risks,
  }
}

function filterCampaigns(data: DashboardData, filters: DashboardFilters, start: string, end: string) {
  return data.campaigns.filter((campaign) => campaign.endDate >= start && campaign.startDate <= end)
    .filter((campaign) => filters.campaignScope === 'All' || campaign.scope === filters.campaignScope)
    .filter((campaign) => !filters.campaignIds.length || filters.campaignIds.includes(campaign.id))
    .filter((campaign) => !filters.regionIds.length || campaign.regionIds.some((id) => filters.regionIds.includes(id)))
    .filter((campaign) => !filters.countryIds.length || campaign.countryIds.some((id) => filters.countryIds.includes(id)))
    .filter((campaign) => !filters.categoryIds.length || campaign.categoryIds.some((id) => filters.categoryIds.includes(id)))
    .filter((campaign) => !filters.productIds.length || campaign.productIds.some((id) => filters.productIds.includes(id)))
    .filter((campaign) => filters.channel === 'All' || campaign.channels.includes(filters.channel))
}

function kpi(current: number | null, prior: number | null, sparkline: number[] = []): DashboardView['kpis']['netSales'] {
  return { current, prior, delta: current !== null && prior !== null && prior !== 0 ? current - prior : null, sparkline }
}

function computeKpis(sales: SalesRecord[], inventory: InventoryRecord[], performances: CampaignPerformance[], campaigns: Campaign[], decisions: ProductDecision[]) {
  const revenue = sum(sales.map(netSales))
  const units = sum(sales.map((sale) => sale.unitsSold - sale.unitsReturned))
  const margin = grossMarginPct(sales)
  const sellThrough = sellThroughPct(sales, inventory)
  const campaignIds = new Set(performances.map((item) => item.campaignId))
  const spend = sum(campaigns.filter((campaign) => campaignIds.has(campaign.id)).map((campaign) => campaign.spend))
  const attributed = sum(performances.map((item) => item.attributedSales))
  const roas = spend > 0 ? attributed / spend : null
  const atRisk = decisions.filter((item) => item.recommendation === 'Markdown' || item.recommendation === 'Discontinue review').length
  return { revenue, units, margin, sellThrough, roas, atRisk }
}

export function buildDashboardView(data: DashboardData, filters: DashboardFilters): DashboardView {
  const campaigns = filterCampaigns(data, filters, filters.dateRange[0], filters.dateRange[1])
  const comparison = comparisonRange(filters.dateRange[0], filters.dateRange[1], filters.comparison)
  const campaignIds = campaigns.map((campaign) => campaign.id)
  const currentSales = data.sales.filter((sale) => sale.date >= filters.dateRange[0] && sale.date <= filters.dateRange[1])
    .filter((sale) => matchesSalesDimensions(sale, data, filters, campaigns))
  const previousSales = data.sales.filter((sale) => sale.date >= comparison.start && sale.date <= comparison.end)
    .filter((sale) => matchesSalesDimensions(sale, data, filters, campaigns))
  const currentInventoryPeriod = data.inventory.filter((item) => item.date >= filters.dateRange[0] && item.date <= filters.dateRange[1] && matchesInventoryDimensions(item, data, filters))
  const previousInventoryPeriod = data.inventory.filter((item) => item.date >= comparison.start && item.date <= comparison.end && matchesInventoryDimensions(item, data, filters))
  const currentInventory = currentInventorySnapshot(currentInventoryPeriod, data, filters, filters.dateRange[1])
  const previousInventory = currentInventorySnapshot(previousInventoryPeriod, data, filters, comparison.end)
  const performances = data.campaignPerformance.filter((item) => campaignIds.includes(item.campaignId))
    .filter((item) => currentSales.some((sale) => sale.productId === item.productId && sale.regionId === item.regionId))
  const decisions = data.products
    .filter((product) => !filters.categoryIds.length || filters.categoryIds.includes(product.category))
    .filter((product) => !filters.productIds.length || filters.productIds.includes(product.id))
    .filter((product) => !filters.seasons.length || filters.seasons.includes(product.season))
    .map((product) => buildProductDecision(data, product, currentSales, previousSales, currentInventory, currentInventoryPeriod, performances, campaigns))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
  const filteredPreviousPerformances = data.campaignPerformance.filter((item) => campaigns.some((campaign) => campaign.id === item.campaignId))
  const previousCampaigns = filterCampaigns(data, filters, comparison.start, comparison.end)
  const previousCampaignIds = new Set(previousCampaigns.map((campaign) => campaign.id))
  const previousCampaignPerformance = filteredPreviousPerformances.filter((item) => previousCampaignIds.has(item.campaignId))
  const currentKpis = computeKpis(currentSales, currentInventoryPeriod, performances, campaigns, decisions)
  const previousKpis = computeKpis(previousSales, previousInventoryPeriod, previousCampaignPerformance, previousCampaigns, decisions)
  const groupByPeriod = (sales: SalesRecord[], aggregation: Aggregation) => {
    const groups = new Map<string, SalesRecord[]>()
    sales.forEach((sale) => {
      const date = toUtc(sale.date)
      let key = sale.date
      if (aggregation === 'month') key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
      if (aggregation === 'quarter') key = `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`
      if (aggregation === 'week') {
        const week = new Date(date)
        week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7))
        key = isoDate(week)
      }
      groups.set(key, [...(groups.get(key) ?? []), sale])
    })
    return groups
  }
  const trendGroups = groupByPeriod(currentSales, 'month')
  const salesTrend = [...trendGroups.entries()].sort(([a], [b]) => a.localeCompare(b))
  const regions = data.dimensions.regions.filter((region) => !filters.regionIds.length || filters.regionIds.includes(region.id)).map((region) => {
    const current = currentSales.filter((sale) => sale.regionId === region.id)
    const prior = previousSales.filter((sale) => sale.regionId === region.id)
    const revenue = sum(current.map(netSales))
    const priorRevenue = sum(prior.map(netSales))
    const store = sum(current.filter((sale) => sale.channel === 'Store').map(netSales))
    const online = sum(current.filter((sale) => sale.channel === 'Online').map(netSales))
    return {
      regionId: region.id,
      region: region.name,
      netSales: revenue,
      units: sum(current.map((sale) => sale.unitsSold - sale.unitsReturned)),
      grossMarginPct: grossMarginPct(current),
      growthPct: priorRevenue ? (revenue - priorRevenue) / priorRevenue : null,
      storeShare: revenue ? store / revenue : 0,
      onlineShare: revenue ? online / revenue : 0,
    }
  }).sort((a, b) => b.netSales - a.netSales)
  const lastTwelve = salesTrend.slice(-12).map(([, group]) => group)
  const sparkFor = (selector: (sales: SalesRecord[]) => number | null) => lastTwelve.map((group) => selector(group) ?? 0)
  return {
    currentSales,
    previousSales,
    currentInventory,
    previousInventory,
    currentInventoryPeriod,
    previousInventoryPeriod,
    campaigns,
    campaignPerformance: performances,
    decisions,
    kpis: {
      netSales: kpi(currentKpis.revenue, previousKpis.revenue, sparkFor((group) => sum(group.map(netSales)))),
      unitsPurchased: kpi(currentKpis.units, previousKpis.units, sparkFor((group) => sum(group.map((sale) => sale.unitsSold - sale.unitsReturned)))),
      grossMarginPct: kpi(currentKpis.margin, previousKpis.margin, sparkFor((group) => grossMarginPct(group))),
      sellThroughPct: kpi(currentKpis.sellThrough, previousKpis.sellThrough, []),
      campaignRoas: kpi(currentKpis.roas, previousKpis.roas, []),
      atRiskStyles: kpi(currentKpis.atRisk, previousKpis.atRisk, []),
    },
    regions,
  }
}

export function aggregateByDate(sales: SalesRecord[], aggregation: Aggregation) {
  const groups = new Map<string, SalesRecord[]>()
  sales.forEach((sale) => {
    const date = toUtc(sale.date)
    let key = sale.date
    if (aggregation === 'month') key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    if (aggregation === 'quarter') key = `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`
    if (aggregation === 'week') {
      const week = new Date(date)
      week.setUTCDate(week.getUTCDate() - ((week.getUTCDay() + 6) % 7))
      key = isoDate(week)
    }
    groups.set(key, [...(groups.get(key) ?? []), sale])
  })
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, rows]) => ({
    period,
    netSales: sum(rows.map(netSales)),
    units: sum(rows.map((sale) => sale.unitsSold - sale.unitsReturned)),
    grossProfit: sum(rows.map((sale) => netSales(sale) - sale.cogs)),
  }))
}
