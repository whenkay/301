# Chanell Global Apparel Performance Dashboard

## 1. Product Summary

Build a responsive, single-page operational dashboard for **Chanell**, a fictional national luxury apparel brand with global sales. The interface should help upper management assess apparel performance across regions, seasons, calendar events, channels, and advertising campaigns, then decide:

- Which apparel categories or products to expand, maintain, markdown, or discontinue
- Which regional, national, and global campaigns deserve additional investment
- Where customer demand differs between stores and online
- Whether campaigns generated meaningful incremental sales and profitable demand
- Where inventory availability is constraining revenue or creating excess stock

The visual direction may be inspired by the restraint, contrast, editorial pacing, and monochrome presentation associated with Chanel, but the implementation must not copy Chanel trademarks, logos, proprietary typefaces, photography, layouts, or branded creative assets. Use the fictional **CHANELL** wordmark as plain text only.

## 2. Required Technology

- Vue 3
- TypeScript
- Vite
- Vuetify 3
- Chart.js through `vue-chartjs` for every chart
- Local JSON data only
- No API calls
- Single page
- No Vue Router
- Composition API with `<script setup lang="ts">`

Recommended supporting packages:

- `date-fns` for date formatting and range calculations
- `@mdi/font` for restrained utility icons
- `eslint` and `prettier`
- `vitest` and `@vue/test-utils`

## 3. Primary Users and Decisions

### Primary users

- Chief executive and operating leadership
- Merchandising leadership
- Commercial and regional sales leadership
- Marketing leadership
- Store and ecommerce leadership

### Key decisions

1. Continue, scale, markdown, or discontinue an apparel line.
2. Increase, reduce, or stop investment in a campaign.
3. Shift inventory between regions or channels.
4. Prioritize seasonal collections and calendar-event assortments.
5. Determine whether weak sales reflect low demand, poor availability, or ineffective advertising.

## 4. Design Direction

### Brand character

Editorial, assured, luxurious, minimal, structured, and data-dense without feeling busy.

### Color system

Use high contrast black and white as the dominant palette.

```ts
export const colors = {
  ink: '#050505',
  black: '#000000',
  white: '#FFFFFF',
  paper: '#F7F7F5',
  softGray: '#E8E8E5',
  midGray: '#A0A0A0',
  darkGray: '#333333',
  positive: '#1F6B45',
  negative: '#A52A2A',
  warning: '#8A6500',
}
```

Black, white, and gray should account for nearly all of the interface. Reserve muted semantic colors for small status indicators, deltas, and alert states. Never rely on color alone to communicate meaning.

### Typography

Use open-source or system fonts only.

- Primary sans serif: `Inter`, fallback `Arial, sans-serif`
- Editorial accent serif: `Cormorant Garamond`, fallback `Georgia, serif`
- Use serif italics sparingly for page subtitles, collection names, and short editorial labels
- Use uppercase sans serif with expanded letter spacing for navigation labels, section labels, and the CHANELL text wordmark
- Use tabular numerals for KPIs and tables

```css
--font-ui: 'Inter', Arial, sans-serif;
--font-editorial: 'Cormorant Garamond', Georgia, serif;
--tracking-label: 0.12em;
```

### Layout and surfaces

- White page background with black header and fine gray dividers
- Avoid heavy shadows, gradients, glass effects, and rounded “app-like” cards
- Card radius: 0 to 4px
- Border: 1px solid `#D8D8D4`
- Use generous whitespace and strict alignment
- Use product imagery only if locally supplied and properly licensed; otherwise use monochrome category placeholders
- Desktop maximum content width: 1920px

## 5. Responsive Behavior

### Desktop, 1440px and above

- Persistent left filter rail: 280px
- Main content: 12-column grid
- KPI strip: 6 cards in one row
- Charts arranged in 8/4, 6/6, or 4/4/4 spans
- Product decision table shows all columns

### Tablet, 768px to 1439px

- Filters move into a top expandable panel
- KPI strip: 3 cards per row
- Primary charts stack or use 7/5 spans where readable
- Decision table permits horizontal scrolling

### Mobile, below 768px

- Compact black header
- Filters open in a full-width bottom sheet or dialog
- KPI cards: 2 per row, then 1 per row below 420px
- All charts stack vertically
- Product table becomes a ranked card list with expandable details
- Minimum touch target: 44px
- Charts must not require hover; tap and keyboard focus reveal tooltips

## 6. Page Architecture

### A. Global header

Content:

- Plain-text CHANELL wordmark
- Page title: `Global Apparel Performance`
- Subtitle in serif italics: `Commercial intelligence for collection and campaign decisions`
- Data period label
- “Last refreshed” timestamp from local JSON metadata
- Export button for filtered CSV
- Filter button on tablet and mobile

### B. Executive filter rail

Filters apply to all KPIs, charts, and tables unless expressly noted.

- Date range
- Comparison: previous period / previous year
- Geography level: global / region / country / market
- Region multi-select
- Country multi-select
- Channel: all / stores / online
- Apparel category
- Product or collection
- Season
- Calendar event
- Campaign scope: regional / national / global
- Campaign selector
- Customer segment
- Reset filters

Required interaction: show active filters as removable chips above the KPI strip. Changing any filter updates the page immediately from in-memory local data.

### C. Executive KPI strip

Six KPI cards:

1. **Net Sales**: amount, comparison delta, share of global sales
2. **Units Purchased**: units, comparison delta
3. **Gross Margin**: percentage and basis-point change
4. **Sell-Through**: percentage and comparison delta
5. **Campaign ROAS**: return on ad spend and comparison delta
6. **At-Risk Styles**: count of styles recommended for markdown or discontinuation

Each card includes:

- Current value
- Comparison value or delta
- 12-period sparkline rendered with Chart.js
- Context label reflecting active filters
- Accessible explanatory tooltip

### D. Global performance overview

#### 1. Geographic performance

Preferred visualization: choropleth-style map only if implemented through an approved Chart.js-compatible approach. Otherwise use a horizontal regional ranking bar chart to avoid adding another charting library.

Show:

- Net sales
- Units
- Gross margin
- Year-over-year growth
- Store versus online mix

Interaction:

- Select a region to cross-filter the page
- Toggle metric
- Display rank, value, delta, and channel mix in tooltip

#### 2. Sales and purchasing trend

Chart.js mixed chart:

- Bars: units purchased
- Solid line: net sales
- Dashed line: prior-year net sales
- Campaign-period background annotations implemented with a lightweight custom Chart.js plugin, not a new chart library

Controls:

- Week / month / quarter aggregation
- Store / online / combined toggle
- Optional normalized index view for comparing differently scaled measures

### E. Apparel and seasonal performance

#### 1. Category performance matrix

Chart.js bubble chart:

- X-axis: sales growth
- Y-axis: gross margin
- Bubble size: net sales
- Bubble border style: recommendation status
- Each bubble represents an apparel category or product, depending on the selected drill level

Quadrants:

- Invest
- Protect
- Improve
- Exit review

Provide quadrant labels outside the canvas for accessibility. Clicking a bubble selects the item and opens the detail drawer.

#### 2. Season and calendar-event demand

Chart.js grouped bar chart or heatmap-style matrix built with horizontal bar datasets:

- Seasons: Spring, Summer, Fall, Winter, Resort, Holiday
- Events: New Year, Valentine’s Day, Mother’s Day, Graduation, Summer Travel, Back to School, Fashion Week, Black Friday, Holiday Gifting
- Metrics: net sales, units, sell-through, margin

Allow switch between:

- Seasonal view
- Calendar-event view
- Current versus prior year

#### 3. Channel mix

Chart.js stacked bars by apparel category:

- Store sales
- Online sales
- Store units
- Online units

Metric toggle prevents displaying four measures simultaneously. Default to sales share.

### F. Advertising effectiveness

#### 1. Campaign impact timeline

Chart.js line chart with campaign markers.

For each campaign, show:

- Scope: regional, national, or global
- Advertised apparel or collection
- Flight dates
- Spend
- Sales before, during, and after flight
- Incremental sales
- Incremental margin
- ROAS
- Conversion lift

Do not imply causality from correlation alone. Label calculated impact as an analytical estimate based on the synthetic comparison method.

#### 2. Campaign investment portfolio

Chart.js scatter plot:

- X-axis: campaign spend
- Y-axis: incremental gross margin
- Point size: attributed revenue
- Point shape or border: campaign scope
- Reference diagonal: break-even threshold

Strategic categories:

- Scale
- Optimize
- Retest
- Stop

#### 3. Campaign and apparel table

Columns:

- Campaign
- Scope
- Market
- Apparel promoted
- Flight dates
- Spend
- Attributed sales
- Incremental margin
- ROAS
- Conversion lift
- Recommendation

Support sort, search, and row expansion.

### G. Product decision center

This is the primary decision-support section.

#### Ranked table fields

- Rank
- Product / style
- Category
- Collection
- Region
- Season
- Event affinity
- Net sales
- Units
- Sales growth
- Gross margin
- Sell-through
- Weeks of supply
- Return rate
- Store / online mix
- Campaign support
- Campaign ROAS
- Recommendation
- Confidence
- Key reason

#### Recommendation states

- **Invest**: strong demand, healthy margin, acceptable inventory, effective campaign support
- **Maintain**: stable performance without a compelling scale or exit signal
- **Optimize**: viable product with a fixable channel, region, price, inventory, or campaign issue
- **Markdown**: excess inventory or weakening demand requiring near-term intervention
- **Discontinue review**: persistently weak demand and margin with no strong strategic or campaign signal

Recommendations must be deterministic and transparent. Never rank on sales alone.

Suggested synthetic scoring model:

```ts
score =
  salesGrowthIndex * 0.20 +
  grossMarginIndex * 0.20 +
  sellThroughIndex * 0.20 +
  inventoryHealthIndex * 0.15 +
  campaignEfficiencyIndex * 0.15 +
  returnRateIndex * 0.10
```

Rules:

```ts
if (score >= 80 && grossMarginPct >= 0.62) recommendation = 'Invest'
else if (score >= 65) recommendation = 'Maintain'
else if (score >= 50) recommendation = 'Optimize'
else if (weeksOfSupply > 16 && sellThroughPct < 0.50) recommendation = 'Markdown'
else recommendation = 'Discontinue review'
```

These thresholds are demo assumptions and must be centralized in configuration, not embedded throughout components.

### H. Product detail drawer

Open from a table row or chart selection.

Include:

- Product summary and recommendation
- Current-period KPIs
- Sales and units trend
- Regional ranking
- Store / online mix
- Seasonal and event performance
- Campaign history and effectiveness
- Inventory health
- Plain-language explanation: “Why this recommendation”
- Three strongest supporting factors and up to two risks

### I. Methodology and data notes

Collapsible footer panel:

- Data is synthetic and local
- KPI formulas
- Recommendation logic
- Campaign attribution assumptions
- Currency handling
- Last refresh timestamp
- Known limitations

## 7. KPI Definitions

- **Gross Sales** = sum of list-price sales before discounts and returns
- **Net Sales** = gross sales minus discounts and returns
- **Units Purchased** = completed units sold, net of canceled orders
- **Average Order Value** = net sales / completed orders
- **Gross Margin %** = (net sales - cost of goods sold) / net sales
- **Sell-Through %** = units sold / (opening inventory + receipts)
- **Weeks of Supply** = ending inventory / average weekly unit sales
- **Return Rate** = returned units / shipped units
- **Online Mix %** = online net sales / total net sales
- **ROAS** = attributed sales / campaign spend
- **Incremental Sales** = observed sales during campaign minus synthetic baseline sales
- **Incremental Margin** = incremental sales minus incremental COGS minus campaign spend
- **Conversion Lift** = campaign conversion rate minus baseline conversion rate, expressed as a percentage change

Handle division by zero by returning `null`, displayed as `Not available`, never `0`.

## 8. Local Data Contract

Store data in `src/data/dashboard.json`.

```json
{
  "metadata": {
    "brand": "Chanell",
    "currency": "USD",
    "periodStart": "2025-01-01",
    "periodEnd": "2026-08-31",
    "lastRefreshed": "2026-09-01T08:00:00Z",
    "isSynthetic": true
  },
  "dimensions": {
    "regions": [],
    "countries": [],
    "channels": ["Store", "Online"],
    "categories": [],
    "seasons": [],
    "calendarEvents": [],
    "customerSegments": []
  },
  "products": [],
  "sales": [],
  "inventory": [],
  "campaigns": [],
  "campaignPerformance": [],
  "targets": []
}
```

### Core TypeScript interfaces

```ts
export type Channel = 'Store' | 'Online'
export type CampaignScope = 'Regional' | 'National' | 'Global'
export type Recommendation =
  | 'Invest'
  | 'Maintain'
  | 'Optimize'
  | 'Markdown'
  | 'Discontinue review'

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
}

export interface SalesRecord {
  date: string
  productId: string
  regionId: string
  countryId: string
  channel: Channel
  calendarEventId: string | null
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
  objective: 'Awareness' | 'Consideration' | 'Conversion'
  channels: string[]
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
```

### Synthetic data volume

Generate enough local records to make filtering meaningful without slowing the browser:

- 6 regions
- 18 to 24 countries
- 8 apparel categories
- 40 to 60 products/styles
- 20 months of weekly sales
- 2 channels
- 18 to 24 campaigns
- 10 calendar events

Use a fixed seed so the dataset is reproducible. Include realistic positive and negative cases, not uniformly growing data.

## 9. Suggested Apparel Taxonomy

Categories:

- Outerwear
- Jackets
- Dresses
- Knitwear
- Tops
- Trousers
- Skirts
- Occasionwear

Collections / seasons:

- Spring
- Summer
- Fall
- Winter
- Resort
- Holiday

Regions:

- North America
- Latin America
- Europe
- Middle East and Africa
- Greater China
- Asia Pacific

## 10. Application Structure

```text
src/
  App.vue
  main.ts
  plugins/
    vuetify.ts
    chart.ts
  assets/
    styles/
      tokens.css
      typography.css
      app.css
  components/
    layout/
      AppHeader.vue
      FilterRail.vue
      ActiveFilterChips.vue
    kpi/
      KpiStrip.vue
      KpiCard.vue
    charts/
      RegionalPerformanceChart.vue
      SalesPurchaseTrendChart.vue
      CategoryMatrixChart.vue
      SeasonalDemandChart.vue
      ChannelMixChart.vue
      CampaignImpactChart.vue
      CampaignPortfolioChart.vue
    tables/
      ProductDecisionTable.vue
      CampaignPerformanceTable.vue
    detail/
      ProductDetailDrawer.vue
    shared/
      SectionHeader.vue
      MetricToggle.vue
      EmptyState.vue
      DataMethodology.vue
  composables/
    useDashboardData.ts
    useDashboardFilters.ts
    useKpis.ts
    useProductRecommendations.ts
    useCampaignMetrics.ts
    useCsvExport.ts
  data/
    dashboard.json
  types/
    dashboard.ts
  utils/
    calculations.ts
    chartOptions.ts
    formatters.ts
    recommendationRules.ts
  tests/
    calculations.spec.ts
    filters.spec.ts
    recommendations.spec.ts
```

## 11. State and Data Flow

No separate state-management package is required.

- `useDashboardData`: imports and validates local JSON once
- `useDashboardFilters`: owns reactive filter state and reset behavior
- `filteredSales`, `filteredInventory`, and `filteredCampaigns`: computed values
- KPI and chart composables consume only filtered computed collections
- Selection state is shared at `App.vue` level for cross-filtering
- URL persistence is not required because there is no routing
- Optional: persist the last filter state in `localStorage`

Avoid having individual chart components calculate business metrics. Charts receive presentation-ready datasets and options through typed props.

## 12. Chart.js Standards

- Register Chart.js elements once in `plugins/chart.ts`
- Use `responsive: true` and `maintainAspectRatio: false`
- Wrap every chart in a container with an explicit responsive height
- Disable animations when `prefers-reduced-motion` is enabled
- Use HTML summaries or adjacent tables for complex charts
- Use consistent tooltip formatting and currency rules
- Destroy or update chart instances cleanly through `vue-chartjs`
- Do not use another visualization library
- Use patterns, borders, labels, and point shapes to distinguish series in monochrome

Example shared options:

```ts
export const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'nearest', intersect: false },
  plugins: {
    legend: {
      labels: {
        color: '#050505',
        usePointStyle: true,
        boxWidth: 8,
      },
    },
    tooltip: {
      backgroundColor: '#000000',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      padding: 12,
    },
  },
}
```

## 13. Accessibility

Target WCAG 2.2 AA.

- Full keyboard access for filters, chart controls, tables, and drawer
- Visible black-and-white focus treatment at least 2px thick
- Semantic headings in logical order
- Every chart has an accessible title, concise description, and tabular summary
- Announce filter-result changes through an `aria-live="polite"` region
- Do not encode meaning through color alone
- Maintain at least 4.5:1 contrast for normal text
- Preserve readable text at 200% zoom
- Honor reduced-motion preferences
- Use meaningful button labels, not icon-only controls without accessible names

## 14. Loading, Empty, and Error States

Even though data is local, implement resilient states.

- Loading: skeleton KPI cards and chart regions
- Empty filter result: explain that no records match and provide `Reset filters`
- Invalid JSON: show a non-technical error panel and log schema details in development
- Missing metric: show `Not available`
- Partial campaign data: show available measures and identify missing attribution fields

## 15. Export Behavior

Export the currently filtered product decision table as CSV.

Filename:

```text
chanell-product-decisions-YYYY-MM-DD.csv
```

Include active filter values and export timestamp as the first commented rows or in a companion metadata section. Do not export hidden raw customer-level data.

## 16. Performance Requirements

- Initial app remains responsive with the recommended synthetic dataset
- Filter updates should feel immediate
- Memoize or pre-aggregate expensive calculations where practical
- Debounce free-text search by 200ms
- Avoid deep watchers over the full dataset
- Lazy-render below-the-fold charts with `IntersectionObserver` if needed
- Keep chart dataset objects stable where possible to minimize redraws

## 17. Acceptance Criteria

### Functional

- App runs locally with `npm install` and `npm run dev`
- No network requests appear in the browser network panel
- All data loads from local JSON
- All charts use Chart.js through `vue-chartjs`
- All global filters update KPIs, charts, and tables consistently
- Region and product selections cross-filter related content
- Store and online performance can be compared
- Seasonal and calendar-event performance can be compared
- Campaigns can be analyzed by regional, national, and global scope
- Product recommendations expose supporting reasons
- Filtered decision data exports to CSV
- No routing dependency or route configuration exists

### Visual

- Black and white dominate the interface
- Modern sans serif typography is primary
- Elegant serif italics are used only as accents
- Interface feels editorial and premium without copying Chanel assets
- Desktop, tablet, and mobile layouts are fully usable
- Charts remain legible in monochrome

### Quality

- TypeScript strict mode passes
- No `any` in business data types
- KPI formulas and recommendation rules have unit tests
- No console errors or warnings in production build
- Empty, missing-data, and invalid-data states are handled
- Accessibility checks show no critical violations

## 18. Out of Scope

- Authentication or authorization
- Backend services
- Live data integrations
- Predictive machine learning
- Customer-level drill-down
- Route-based pages
- Editing campaign budgets or inventory in the dashboard
- Use of Chanel logos, proprietary fonts, campaign photography, or copied UI assets

## 19. Implementation Priority

### P0

- App shell and responsive layout
- Local JSON loading and TypeScript models
- Global filters
- KPI strip
- Regional performance
- Sales and purchasing trend
- Category matrix
- Product decision table and recommendation logic

### P1

- Seasonal and calendar-event demand
- Channel mix
- Campaign impact and portfolio
- Product detail drawer
- CSV export

### P2

- Filter persistence
- Lazy rendering
- Expanded accessibility summaries
- Additional campaign-methodology notes

## 20. Definition of Done

The dashboard is done when an executive can select a market, season, event, channel, apparel category, and campaign scope; understand sales, purchasing volume, margin, inventory health, and advertising effectiveness; then identify which apparel to invest in, optimize, markdown, or place under discontinuation review, with every recommendation supported by visible metrics and a plain-language rationale.
