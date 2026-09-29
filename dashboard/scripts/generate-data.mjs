import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(projectRoot, 'src/data/dashboard.json')
const seedStart = 20260901
let seed = seedStart

function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 4294967296
}

function pick(items) {
  return items[Math.floor(random() * items.length)]
}

function between(min, max) {
  return min + random() * (max - min)
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits))
}

function iso(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function inPeriod(date) {
  return date >= '2025-01-01' && date <= '2026-08-31'
}

const regions = [
  { id: 'north-america', name: 'North America' },
  { id: 'latin-america', name: 'Latin America' },
  { id: 'europe', name: 'Europe' },
  { id: 'mea', name: 'Middle East & Africa' },
  { id: 'greater-china', name: 'Greater China' },
  { id: 'asia-pacific', name: 'Asia Pacific' },
]

const countrySeed = [
  ['United States', 'north-america'], ['Canada', 'north-america'], ['Mexico', 'north-america'], ['Brazil', 'latin-america'],
  ['Colombia', 'latin-america'], ['Chile', 'latin-america'], ['United Kingdom', 'europe'], ['France', 'europe'],
  ['Italy', 'europe'], ['Germany', 'europe'], ['Spain', 'europe'], ['United Arab Emirates', 'mea'], ['South Africa', 'mea'],
  ['Saudi Arabia', 'mea'], ['Nigeria', 'mea'], ['China', 'greater-china'], ['Hong Kong', 'greater-china'], ['Taiwan', 'greater-china'],
  ['Japan', 'asia-pacific'], ['South Korea', 'asia-pacific'], ['Australia', 'asia-pacific'], ['Singapore', 'asia-pacific'],
  ['Thailand', 'asia-pacific'], ['India', 'asia-pacific'],
]
const countries = countrySeed.map(([name, regionId], index) => ({
  id: `country-${String(index + 1).padStart(2, '0')}`,
  name,
  regionId,
  market: name,
}))

const categories = ['Outerwear', 'Jackets', 'Dresses', 'Knitwear', 'Tops', 'Trousers', 'Skirts', 'Occasionwear']
const seasons = ['Spring', 'Summer', 'Fall', 'Winter', 'Resort', 'Holiday']
const channels = ['Store', 'Online']
const eventDefs = [
  ['new-year', 'New Year', 1, 1, 1.16], ['valentines', "Valentine's Day", 2, 14, 1.24],
  ['mothers-day', "Mother's Day", 5, 10, 1.32], ['graduation', 'Graduation', 6, 1, 1.18],
  ['summer-travel', 'Summer Travel', 7, 1, 1.14], ['back-to-school', 'Back to School', 8, 15, 1.10],
  ['fashion-week', 'Fashion Week', 9, 15, 1.20], ['black-friday', 'Black Friday', 11, 27, 1.30],
  ['holiday-gifting', 'Holiday Gifting', 12, 10, 1.34], ['resort-launch', 'Resort Launch', 11, 1, 1.17],
]
const calendarEvents = eventDefs.map(([id, name, month, day, liftFactor]) => ({ id, name, month, day, liftFactor }))
const customerSegments = [
  { id: 'core-client', name: 'Core Client', description: 'Repeat customers with established brand affinity' },
  { id: 'new-client', name: 'New Client', description: 'First purchase or recently acquired customer' },
  { id: 'occasion-client', name: 'Occasion Client', description: 'Purchases concentrated around gifting and events' },
  { id: 'high-value-client', name: 'High Value Client', description: 'Customers with above-average order value' },
]

const productNouns = ['Tailored Coat', 'Soft Blazer', 'Evening Dress', 'Cashmere Knit', 'Silk Blouse', 'Wide-Leg Trouser', 'Pencil Skirt', 'Column Gown', 'Boucle Jacket', 'Merino Cardigan', 'Day Dress', 'Fine-Gauge Polo']
const products = Array.from({ length: 40 }, (_, index) => {
  const category = categories[index % categories.length]
  const collection = `Collection ${['A', 'B', 'C', 'D'][index % 4]}`
  const season = seasons[(index * 5 + Math.floor(index / 8)) % seasons.length]
  const cost = round(between(85, 580))
  const marginProfile = [0.49, 0.56, 0.63, 0.68, 0.73][index % 5]
  return {
    id: `style-${String(index + 1).padStart(3, '0')}`,
    styleCode: `CN-${String(2501 + index).slice(-4)}`,
    name: `${['Noir', 'Sable', 'Ivory', 'Graphite', 'Pearl', 'Midnight'][index % 6]} ${productNouns[index % productNouns.length]}`,
    category,
    collection,
    season,
    launchDate: `${2025 + Math.floor(index / 36)}-${String((index % 12) + 1).padStart(2, '0')}-01`,
    status: index % 13 === 0 ? 'Exit review' : index % 9 === 0 ? 'Carryover' : 'Active',
    unitCost: cost,
    listPrice: round(cost / (1 - marginProfile)),
    returnRisk: round(between(0.025, 0.19), 3),
    demandProfile: [0.62, 0.78, 0.92, 1.05, 1.16, 1.28, 0.74, 0.86][index % 8],
  }
})

const eventDateFor = (date) => {
  const year = date.getUTCFullYear()
  return calendarEvents.find((event) => {
    const eventDate = Date.UTC(year, event.month - 1, event.day)
    return Math.abs(date.getTime() - eventDate) <= 21 * 24 * 60 * 60 * 1000
  }) ?? null
}

const weekStarts = []
let currentWeek = new Date('2025-01-06T00:00:00.000Z')
while (iso(currentWeek) <= '2026-08-31') {
  weekStarts.push(new Date(currentWeek))
  currentWeek = addDays(currentWeek, 7)
}

const sales = []
const inventory = []
for (const [productIndex, product] of products.entries()) {
  for (const [weekIndex, date] of weekStarts.entries()) {
    const region = regions[(productIndex * 3 + Math.floor(weekIndex / 3) + weekIndex) % regions.length]
    const countryOptions = countries.filter((country) => country.regionId === region.id)
    const country = countryOptions[(productIndex + weekIndex) % countryOptions.length]
    const event = eventDateFor(date)
    const yearTrend = date.getUTCFullYear() === 2025 ? 0.93 : productIndex % 4 === 0 ? 0.84 : 1.08
    const seasonalWave = 0.83 + 0.22 * Math.sin((date.getUTCMonth() + productIndex % 6) * Math.PI / 6)
    const eventLift = event ? event.liftFactor : 1
    for (const channel of channels) {
      const channelFactor = channel === 'Online' ? 0.76 + (productIndex % 3) * 0.06 : 1
      const unitsSold = Math.max(2, Math.round(between(16, 92) * product.demandProfile * seasonalWave * eventLift * yearTrend * channelFactor))
      const grossSales = round(unitsSold * product.listPrice, 0)
      const discountRate = productIndex % 7 === 0 ? between(0.15, 0.28) : between(0.035, 0.15)
      const discounts = round(grossSales * discountRate, 0)
      const returnRate = productIndex % 9 === 0 ? between(0.14, 0.22) : product.returnRisk
      const unitsReturned = Math.min(unitsSold, Math.round(unitsSold * returnRate))
      const returnsValue = round(unitsReturned * product.listPrice * (1 - discountRate), 0)
      const sessions = channel === 'Online' ? Math.round(unitsSold * between(19, 57)) : null
      const conversions = channel === 'Online' ? Math.max(1, Math.round(unitsSold * between(0.55, 0.9))) : null
      const segment = customerSegments[(productIndex + weekIndex + (channel === 'Online' ? 1 : 0)) % customerSegments.length]
      const id = `sale-${product.id}-${weekIndex}-${channel.toLowerCase()}`
      sales.push({
        id,
        date: iso(date),
        productId: product.id,
        regionId: region.id,
        countryId: country.id,
        channel,
        calendarEventId: event?.id ?? null,
        customerSegmentId: segment.id,
        orders: Math.max(1, Math.round(unitsSold / between(1.2, 2.2))),
        grossSales,
        discounts,
        returnsValue,
        unitsSold,
        unitsReturned,
        cogs: round(unitsSold * product.unitCost, 0),
        sessions,
        conversions,
      })
      const openingUnits = Math.round(unitsSold * between(5, 14))
      const receipts = Math.round(unitsSold * between(0.8, 1.8))
      const endingUnits = Math.max(0, Math.round(openingUnits + receipts - unitsSold * between(0.72, 1.18)))
      inventory.push({
        id: `stock-${product.id}-${weekIndex}-${channel.toLowerCase()}`,
        date: iso(date),
        productId: product.id,
        regionId: region.id,
        channel,
        openingUnits,
        receipts,
        endingUnits,
      })
    }
  }
}

const campaignNames = [
  'The Form of Evening', 'Modern Uniform', 'A Study in Texture', 'New Season, New Silhouette',
  'City Dressing', 'The Occasion Edit', 'Quiet Structure', 'Weekend Wardrobe', 'Art of Layering',
  'Holiday Atelier', 'Resort in Motion', 'The Essential Suit', 'Soft Tailoring', 'After Dark',
  'A Line for Living', 'The Winter Edit', 'Spring in Structure', 'Objects of Desire',
  'The Modern Coat', 'Travel Light', 'The Knitwear Salon', 'A Day in Silk', 'The Collection Film', 'Wardrobe, Reframed',
]
const campaignObjectives = ['Awareness', 'Consideration', 'Conversion']
const campaigns = campaignNames.map((name, index) => {
  const productStart = (index * 7) % products.length
  const selectedProducts = Array.from({ length: 3 + index % 3 }, (_, offset) => products[(productStart + offset * 5) % products.length])
  const region = regions[index % regions.length]
  const scope = index % 6 === 0 ? 'Global' : index % 3 === 0 ? 'National' : 'Regional'
  const regionIds = scope === 'Global' ? regions.map((item) => item.id) : scope === 'National' ? regions.slice(index % 3, (index % 3) + 3).map((item) => item.id) : [region.id]
  const countryIds = countries.filter((country) => regionIds.includes(country.regionId)).map((country) => country.id)
  const start = addDays(new Date('2025-01-06T00:00:00.000Z'), ((index * 17) % 78) * 7)
  const end = addDays(start, 20 + (index % 4) * 7)
  return {
    id: `campaign-${String(index + 1).padStart(2, '0')}`,
    name,
    scope,
    regionIds,
    countryIds: scope === 'Global' ? countryIds : countryIds.slice(0, Math.ceil(countryIds.length / 2)),
    productIds: selectedProducts.map((product) => product.id),
    categoryIds: [...new Set(selectedProducts.map((product) => product.category))],
    startDate: iso(start),
    endDate: iso(end),
    spend: Math.round(between(18000, 220000)),
    objective: campaignObjectives[index % campaignObjectives.length],
    channels: index % 4 === 0 ? ['Store'] : index % 4 === 1 ? ['Online'] : ['Store', 'Online'],
  }
})

const campaignPerformance = []
for (const [index, campaign] of campaigns.entries()) {
  for (const productId of campaign.productIds) {
    const product = products.find((item) => item.id === productId)
    const regionId = campaign.regionIds[(index + product.id.charCodeAt(product.id.length - 1)) % campaign.regionIds.length]
    const baselineSales = Math.round(between(12000, 95000))
    const lift = [-0.17, -0.06, 0.04, 0.12, 0.21, 0.33][(index + Number(product.id.slice(-1))) % 6]
    const observedSales = Math.round(baselineSales * (1 + lift))
    const incrementalSales = observedSales - baselineSales
    const incrementalCogs = Math.round(incrementalSales * product.unitCost / product.listPrice)
    const conversionRateBaseline = round(between(0.012, 0.038), 4)
    const conversionRateCampaign = round(conversionRateBaseline * (1 + lift * 1.15), 4)
    campaignPerformance.push({
      campaignId: campaign.id,
      regionId,
      productId,
      baselineSales,
      observedSales,
      attributedSales: Math.round(observedSales * between(0.38, 0.82)),
      incrementalSales,
      incrementalCogs,
      conversionRateBaseline,
      conversionRateCampaign,
    })
  }
}

const data = {
  metadata: {
    brand: 'Chanell',
    currency: 'USD',
    periodStart: '2025-01-01',
    periodEnd: '2026-08-31',
    lastRefreshed: '2026-09-01T08:00:00Z',
    isSynthetic: true,
    seed: seedStart,
  },
  dimensions: { regions, countries, channels, categories, seasons, calendarEvents, customerSegments },
  products,
  sales,
  inventory,
  campaigns,
  campaignPerformance,
  targets: [
    { id: 'gross-margin', label: 'Gross margin target', value: 0.62, format: 'percent' },
    { id: 'sell-through', label: 'Sell-through target', value: 0.65, format: 'percent' },
    { id: 'weeks-supply', label: 'Weeks of supply target', value: 8, format: 'weeks' },
    { id: 'roas', label: 'Campaign ROAS target', value: 2.5, format: 'currency' },
  ],
  recommendationConfig: {
    investScore: 80,
    maintainScore: 65,
    optimizeScore: 50,
    investGrossMargin: 0.62,
    markdownWeeksSupply: 16,
    markdownSellThrough: 0.5,
    inventoryWeeksTarget: 8,
  },
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(data)}\n`)
console.log(`Generated ${sales.length} weekly sales rows, ${inventory.length} inventory rows, ${products.length} styles, and ${campaigns.length} campaigns.`)
