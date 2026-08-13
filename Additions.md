# Feature Gap Analysis vs. DealerPulse Reference Site

Comparison against the deployed reference (`https://dealer-pulse-five.vercel.app`) —
routes explored: `/`, `/analytics`, `/leads`, `/branch/B3`, `/branch/B3/rep/SR17`,
`/branch/B3/rep/SR17/lead/L0022`.

**Scope note:** the reference **Overview (`/`) page is client-rendered**, so its KPIs
could not be extracted from static HTML. Sections below cover everything that was
verifiable on the other server-rendered routes.

---

## 1. Aging Leads report — DEDICATED stale-lead page (missing in ours)

The reference `/leads` is **not** a generic lead table. It is an "Aging Leads /
Detailed Stale Pipelines" report:

| Feature | Reference | Our site |
|---|---|---|
| Stale-lead detection (no activity for 7+ days) | Core concept of the page | Only per-branch/per-rep minilists via `computeLeadAging`; no network-level report |
| At-risk ₹ aggregation in header | `"39 leads with no activity for 7+ days • ₹19.16 Cr at risk"` | Missing |
| "Days Stale" column | `195d`, `67d`, `7d`, color-coded red/amber, sorted desc | Not computed/shown on `/leads` |
| Branch filter pills | URL-driven `All Branches` + B1–B5 pills (`?aging_gt=7&branch=B1`) | Missing |
| Branch + Month dropdowns in page header | `Filter by branch` (All Showrooms), `Filter by month` (All Months) | Only a status dropdown on `/leads` |
| CSV **+ PNG** export on the leads table | Both buttons on the card | CSV only |
| Deep-link per lead | `/branch/B3/rep/SR17/lead/L0022` | Drawer only (no URL) |

## 2. Analytics & Insights page (`/analytics`) — partially missing

Reference consolidates four company-wide analyses into one page. We have some of it
scattered across Overview / Funnel / Alerts but **no single `/analytics` page**:

| Feature | Reference | Our site |
|---|---|---|
| Company-wide **Sales Funnel Summary** with per-stage drop % | 510 → 391 → 300 → 235 → 198 → 160, `↓ 23.3% drop` shown per stage | Funnel page has stages/dwell but not cumulative top-of-funnel % + drop-off layout |
| **Lost Reason Breakdown** | Recharts pie + table `Reason / Count / % of Lost` (288 lost) | Overview has a plain top-5 list (count only, no %, no chart) |
| **Delivery Delay Analysis** | 4 KPI cards (Total 160, Delayed 72/45%, On Time 88/55%, Avg Days 18.3) + timeliness split bar + detailed delay-reason table w/ distribution bars & share pills | **Entirely missing** — we have no delay statistics anywhere |
| **Lead Source Performance** | Chart + table `Source / Total / Delivered / Conversion Rate %` w/ colored pills | Funnel page has source split but not the delivered + conv-% pill table |
| CSV + PNG on every card | Consistent export buttons on all 4 cards | Inconsistent (PNG only on charts) |

## 3. Branch detail page (`/branch/B3`) — partial parity, missing polish

We have the branch drill-down but miss several items the reference shows:

| Feature | Reference | Our site |
|---|---|---|
| KPI cards: `Units 6/264` w/ `2.3%` attainment badge; `Revenue ₹1.07 Cr / Target ₹57.83 Cr`; `Sales Reps 6`; `⚠ Aging Leads 4 / ₹1.23 Cr at risk` | Present | Different KPIs (leads, delivery rate, open pipeline, avg days) — no aging-at-risk card, no units-vs-target badge |
| **Monthly Attainment Trend** chart (Units ± Revenue attainment %) | Present | `PacingChart` shows units vs target but not revenue attainment % |
| **Rep Leaderboard** with Conv. Rate % pill + Avg Days + drill-down links | Present | `Rep leaderboard` table exists, but no conv.-rate pill styling, no rep deep-links |
| Branch funnel with drop-off % | Present | `FunnelBars` exists (no drop % column) |
| Breadcrumb `Company ▸ Lakeside Toyota` | Present | "← All branches" button only |

## 4. Rep detail page (`/branch/B3/rep/SR17`) — mostly parity, few gaps

| Feature | Reference | Our site |
|---|---|---|
| KPI cards: TOTAL LEADS / DELIVERED / CONVERSION / REVENUE / AVG DAYS TO CLOSE | Present | Assigned leads / delivery rate / delivered / lost / avg days / pipeline value (close, no conversion-Rate KPI) |
| **Aging alert callout** `1 lead no activity 7+ days • ₹50.50 L at risk` | Present | `Stale leads need attention` list (no revenue-at-risk amount) |
| **Pipeline status pills** `Order Placed (1) · Delivered (1) · Lost (12)` | Present | Missing |
| Sortable leads table, **URL-driven** (`?month=all&sort=created_at&dir=asc`) | Present | Our leads table sorts client-side only |
| CSV + PNG export on leads card | Present | Not on reps page |
| Per-lead deep links + **AGING pill** on stale rows | Present | Not present |
| Breadcrumb `Company ▸ Branch ▸ Rep` | Present | "← All reps" button only |

## 5. Lead detail page (`/branch/../lead/L0022`) — new route to build

| Feature | Reference | Our site |
|---|---|---|
| **Dedicated route**/deep-linkable per lead | `/branch/B3/rep/SR17/lead/L0022` | Drawer on `/leads` only |
| Full **Lead Information** card (Customer, Phone, Model, Source, Branch, Created, Deal Value ₹50.50 L, Expected Close) | Present | Drawer has fields but no phone/currency-in-lakh styling, shorter set |
| **Status Timeline** — vertical timeline w/ stage badges, icons, timestamp + note, **day-gap annotations** (`+9 days`), **"Current" marker**, colored per-stage | Rich | Drawer has a plain border-left list (no icons/gaps/Current) |
| `⚠ AGING (195d)` badge on stale leads | Present | Missing |
| Breadcrumb `Company ▸ Branch ▸ Rep ▸ Lead` | Present | Missing |

## 6. Cross-cutting UX & polish

| Feature | Reference | Our site |
|---|---|---|
| **Global header Branch + Month filter** (`?month=2025-12&branch=B3`) | Present on all pages | We have richer role/multi-select/date filters in `FilterBar` — different tradeoff, ours is stronger |
| **Breadcrumbs** on every drill-down page | Present | Missing (directional "back" buttons instead) |
| **Mobile bottom nav bar** (`md:hidden`) | Present | Top nav scrolls horizontally on mobile |
| **₹ Indian compact currency** (`₹50.50 L`, `₹1.07 Cr`) | Present | `formatCurrency` = full digits (`₹1,50,500`); no L/Cr helper |
| **Sticky blurred app header** (logo + nav + filters) | Present | Non-sticky header; filters in separate bar |
| Consistent **CSV + PNG export buttons** on data cards | Present everywhere | Inconsistent (forecast only) |
| **Share** button | Absent on reference | We have it (exceeds reference) |
| Icons on all KPI/table headers (Lucide) | Present | Minimal/no icons on most components |

## 7. Levers we already have that the reference lacks

So we exceed the reference on these — note for the record:

- **AI Assistant** (20 curated intents + grounded LLM mode, engine/AI toggle)
- **Executive summary** (deterministic narrative engine)
- **Anomaly detection** flags (statistical z-score strip)
- **Role-based scoping** (CEO / Branch Manager / Sales Rep)
- **Multi-select filters** (branches, reps, sources, models, date range, as-of)
- **Shareable filter URLs** + per-question AI share links (`?q=`)
- **Report / print-PDF route** and **theme toggle**

---

## Suggested build priority (highest → lowest)

1. **Aging Leads report** — new `/leads` view or add staleness to existing table (days-stale col, at-risk ₹, PNG export, branch pills, per-lead deep links).
2. **Delivery Delay Analysis** — new section/chart (KPIs + timeliness bar + reason breakdown with distribution) on a new or existing page.
3. **Dedicated lead detail route** — move/duplicate the drawer into a shareable page with a proper Status Timeline (day-gaps, Current marker, AGING badge).
4. **`/analytics` consolidation** — funnel-with-drop-off + lost-reason pie/table + source-performance table on one page.
5. **Breadcrumbs + sticky header + mobile bottom nav** for consistent navigation.
6. **₹ Lakh/Crore formatter** helper and apply across tables.

---

## Build status

| # | Item | Status |
|---|---|---|
| 1 | Aging Leads report (days-stale col, at-risk ₹, branch pills, PNG export, deep links, aging-only toggle) | ✅ Done — `/leads` |
| 2 | Delivery Delay Analysis (KPIs + timeliness bar + reason breakdown w/ distribution) | ✅ Done — `/analytics` |
| 3 | Dedicated lead detail route (Info card + timeline w/ day-gaps, Current marker, AGING badge) | ✅ Done — `/leads/[id]` |
| 4 | `/analytics` consolidation (funnel w/ drop-off, lost-reason pie + %, source performance) | ✅ Done — `/analytics` |
| 5 | Breadcrumbs + sticky blurred header + mobile bottom nav | ✅ Done |
| 6 | ₹ Lakh/Cr formatter (`formatLakhCr`) applied to revenue displays | ✅ Done |
| 7 | Branch KPIs (units-vs-target, active reps, aging at-risk) + rep pipeline status pills | ✅ Done |

Remaining nice-to-haves (not built): none — all closed:

- **URL-driven sorting** (`?sort=&dir=`) on the branch rep leaderboard and the new rep leads table.
- **CSV export** on branch rep leaderboard + rep leads table (reusable `CsvExportButton`).
- **Attainment-trend chart** on branch pages now includes a revenue line (₹ L) on a secondary axis (`PacingChart`).
- **Rep leads table** added to `/reps?rep=…` with per-lead deep links (`StatusBadge` extracted to a shared component).