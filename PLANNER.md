# DealerPulse — Implementation Planner

**Project:** Real-time Dealership Performance Dashboard (5 branches, 30 reps, 510 leads)
**Data source:** `dealership_data.json` (Jun 1 – Dec 31, 2025, synthetic)
**Stack:** Next.js (App Router) + TypeScript, Tailwind, Recharts, provider-agnostic LLM adapter
**Milestone shape:** working product (not a demo), root-level `DECISIONS.md`

---

## 1. Product decisions locked (from clarifications)

| Topic | Decision |
|---|---|
| Audience | CEO → branch manager → rep, via **simulated role switcher** (no real auth) |
| AI summaries | **Deterministic rule engine** behind a service interface (LLM-swappable) |
| AI chat/QA | **AI Assistant** page: one-click curated questions (`Questions.md`) or free-form questions answered by the integrated LLM over computed metrics |
| Time semantics | Default to latest date (Dec 31, 2025) + **point-in-time ("as of") control** |
| Forecasting | **Weighted pipeline** (stage conversion × close window) + **pace-to-target** |
| Anomaly detection | **Statistical heuristics** (z-score vs peer baselines), explainable flags |
| Charting | **Recharts** |
| IA | **Multi-page** (Overview / Branches / Reps / Leads / Funnel / Alerts / **AI Assistant**) + global filter bar |
| Exports | CSV, chart PNG, shareable URL (state in query), print-ready PDF report |
| Theme | **Light + dark** toggle |
| Priority | **Depth of insight & solid core** over breadth/polish |

---

## 2. Insights from data profile (drive feature emphasis)

- **56% of leads (288) are lost.** Top lost reasons nearly tied (~35–40 each): `Unresponsive after follow-up`, `Financing not approved`, `Better offer elsewhere`, `Not ready to purchase`, `Budget constraints` → **follow-up discipline + financing exposure** are the biggest levers.
- **Huge branch variance:** B1 converts 41% of leads to delivered (40/97); B3 only 8% (6/79). Benchmarking + anomaly detection must surface this.
- `expected_close_date` present on **100%** of leads → weighted pipeline forecast is fully supported.
- Avg **4.1 status-history steps**, 7 states → full-funnel analysis and per-stage conversion are computable.
- 35 `(branch × month)` target rows → 6 full months of pacing history (Jun–Dec) per branch.
- Deliveries: avg 18.3 days; ~45% delayed with reasons (logistics, allocation, finance, RTO) → **delivery-risk alerts**.
- Sources: walk_in (140) / website (100) dominate; referral (83) converts strongly in many industries → **source-channel ROI** panel.

---

## 3. Architecture

```
industrial-iq/
  public/                      # static assets
  data/
    dealership_data.json       # source of truth (imported at build)
  src/
    app/
      layout.tsx               # theme provider + global filter bar (persistent shell)
      page.tsx                 # / → Overview
      branches/page.tsx
      reps/page.tsx
      leads/page.tsx
      funnel/page.tsx
      alerts/page.tsx
      report/page.tsx          # PDF-printable report
      ask/page.tsx             # AI Assistant (chat / curated Q&A)
    lib/
      data/                    # typed loaders + parsers (validate JSON shape)
        types.ts               # Lead, Branch, SalesRep, Target, Delivery
        load.ts                # read dataset, build indexes (branch→reps, rep→leads, etc.)
      engine/                  # pure, framework-free business logic (unit-testable)
        metrics.ts             # KPIs, funnel, conversion, aging, source/channel ROI
        pipeline.ts            # weighted pipeline forecast + pace-to-target
        anomalies.ts           # z-score/percentile anomaly detection
        summaries.ts           # deterministic report generator (LLM-ready interface)
      ai/                      # AI Assistant pipeline (see §6)
        curated.ts             # the 20 curated questions (Questions.md) → metric intents
        context.ts             # builds compact metric context payload for the LLM
        llm.ts                 # LLM adapter (provider-agnostic; env key optional)
      store/                   # URL-bound app state
        filters.ts             # branch, rep, source, model, role, date range, as-of date
        url.ts                 # serialize/deserialize state ↔ query params (shareable URLs)
    components/                # FunnelChart, KPI, Scorecard, AlertsPanel, FilterBar, ExportMenu, ChatPanel, ...
    styles/globals.css
  DECISIONS.md                 # why + tradeoffs + next steps
  PLANNER.md
  Questions.md                 # the 20 curated AI questions
```

### Key engineering principles
1. **Engine = pure functions.** All metrics/forecast/anomaly logic takes `(data, filters, asOfDate)` and returns plain objects. UI is a thin renderer. This makes it testable and LLM-summary swappable.
2. **State lives in the URL.** Role, filters, as-of date, and page are query params → deep-linkable, shareable, back/forward-safe.
3. **As-of date is the heart.** Every computation (aging, funnel, forecast, alerts) accepts `asOfDate` as an argument. Defaults to `2025-12-31`, user can scrub back in time.
4. **One global filter bar** mounted in the shell; every page consumes the same filtered dataset → consistency across views.

---

## 4. Page-by-page scope (MVP content)

### 4.1 Overview (`/`)
- **KPI cards:** leads, delivery rate, units delivered, pipeline value (weighted), avg days-to-deliver, revenue to date vs target.
- **Branch scorecard:** each branch with delivered %, vs-target gauge, trend sparkline → click-through to branch view.
- **Funnel summary** (mini) + lost-leads donut by reason.
- **Executive summary panel:** deterministic natural-language brief (see §6).
- **Top anomalies strip:** top 3 flags with one-line explanations.

### 4.2 Alerts (`/alerts`) — *flagship*
- **Lead aging:** untouched/uncontacted > N days, stale in stage > stage benchmark.
- **Follow-up risk:** `Unresponsive after follow-up` cluster; leads near `expected_close_date` with no recent activity.
- **Pipeline risk:** projected month-end below target (pace deficit), forecast gap warning.
- **Delivery risk:** order_placed/delivered leads with delay-reason prevalence (finance, logistics, allocation).
- **Anomalies:** z-score flags (rep/branch under/over-performing vs peers; sudden source or model shifts).
- Each alert: severity (critical/warning/info), entity, metric, delta, and **reason sentence** generated by the rule engine; click-through drills to the exact lead. Deferrable/dismissable state persisted to `localStorage`.

### 4.3 Branches (`/branches`)
- Branch list → drill into per-branch detail: KPI cards, monthly pacing vs target chart, funnel, rep leaderboard, aged-lead tab, key anomalies.

### 4.4 Reps (`/reps`)
- Leaderboard by delivered units / conversion / revenue; rep drill-down with their funnel, activity recency, top lost reasons, pipeline value.

### 4.5 Leads (`/leads`)
- Search/filterable table (status, source, model, branch, rep, age bucket, close window). Row click → lead drawer with full `status_history` timeline. CSV export of the filtered set.

### 4.6 Funnel (`/funnel`)
- Stage conversion funnel (7 states), per-stage avg dwell time vs benchmark, model-level funnels, source-channel conversion, month-over-month trend.

### 4.7 Report (`/report`)
- Print-optimized, shareable PDF (Via print CSS): executive summary, branch tables, funnel, forecast vs target, alerts appendix. Brand header/footer.

### 4.8 AI Assistant (`/ask`) — *differentiator*
- **Curated questions picker:** the 20 questions from `Questions.md` grouped by theme (Performance vs target · Reps · Funnel · Loss & risk · Delivery · Forecasting). One click sends the question, scoped to the current filters/as-of date.
- **Free-form chat:** type any question; the pipeline grounds the answer in the computed metrics (see §6) rather than letting the LLM hallucinate numbers.
- **Answer modes:** plain-language answer + supporting chart/table chip where the data supports it; citation of the metric source.
- Conversation history in-session; shareable by URL state.

---

## 5. Global filter bar (persistent shell)
- **Role switcher** (CEO / Branch Manager / Rep) — scopes dataset as decided.
- **Branch** multi-select, **source**, **model**, **date range** (Jun–Dec), **as-of date**, **theme toggle**, **export menu** (CSV/PNG/PDF/share-link).

---

## 6. AI layer — summaries + interactive assistant

### 6.1 Deterministic summaries (Overview panel)
- Interface: `generateSummary(dataset, filters, asOfDate): ReportText[]`.
- V1 = rule engine: sentence templates keyed on metric deltas, thresholds, and top risks (e.g., *"B3 is delivering 8% of leads vs 41% network best — investigate quality or follow-up."*).
- Bullet sections: Performance vs target · Funnel health · At-risk leads · Branch/reps to watch · Recommended next actions.

### 6.2 AI Assistant (`/ask`) — curated + free-form Q&A
The 20 curated questions in `Questions.md` become the assistant's "suggested prompts"; the same pipeline powers free-form questions.

1. **`curated.ts`** — maps each of the 20 questions to a **metric intent** (e.g., "Which rep closes the most units?" → `rep_leaderboard(units)`; "Which branches are behind target?" → `pace_vs_target(branch, month)`). Clicking a curated question = sending its canonical prompt.
2. **`context.ts`** — builds a compact, truthful context payload from the engine: KPI summary, funnel, per-branch/rep/ model/source metrics, forecast, alerts — filtered by the current role/filters/as-of date.
3. **`llm.ts`** — provider-agnostic LLM adapter.
   - **With API key** (env): the LLM answers with the metric context as grounding → accurate, specific answers.
   - **Without key (offline):** falls back to the deterministic engine answering the curated intents, so the assistant still works for the 20 questions.
4. **Answer surface:** natural-language response + data table/chart chip when the intent maps to one; every numeric claim traces to a computed metric (no hallucinated figures).

### 6.3 Why this design
- **Grounding over generation:** the LLM never computes numbers; it narrates the engine's outputs → correct, verifiable answers.
- **The 20 questions are the contract:** `Questions.md` defines the must-answer set, so coverage is testable (engine answers all 20; LLM upgrades tone/detail).
- **Graceful degradation** keeps the product fully working without an API key.

---

## 7. Forecast engine (weighted pipeline + pacing)
- Stage→conversion probabilities estimated from historical data by status-state transition within dataset (fallback to calibrated constants).
- `expectedValue = Σ(leads × stage_prob)` within close window, bucketed by month → **best/expected/worst** bands.
- **Pace-to-target:** `projected_units(target month) = delivered_to_date + expected_wins_from_open_pipeline`; deficit vs target → pipeline-risk alert.
- Presented as: monthly forecast chart (bars = target, lines = bands, markers = actual), from Jun → projected Dec.

---

## 8. Anomaly detection (statistical heuristics)
- Peer groups: rep-by-rep vs branch peers; branch vs network; source/model month-over-month.
- Metrics screened: conversion rate, avg days-to-deliver, activity recency, delivery-rate per branch/rep.
- Flag when `|z| > 2` or outside p5/p95 percentile band, limited to statistically meaningful samples to avoid spurious flags on small counts.
- Every flag carries plain-English reasoning + supporting stat + drill link. 

---

## 9. Build plan (ordered)

| Step | Deliverable | Effort |
|---|---|---|
| 1 | Scaffold Next.js (TS) + Tailwind, copy JSON into `data/`, shell layout + theme + filter bar | S |
| 2 | `lib/data` loaders + types; engine skeleton with `metrics.ts` | M |
| 3 | Overview page (KPIs, scorecard, funnel, anomalies strip, exec summary) | M |
| 4 | Alerts page + anomaly engine + aging/follow-up logic | L |
| 5 | Forecast engine + projections chart; pace-to-target | M |
| 6 | Branches + Reps drill-down views | M |
| 7 | Leads table + drawer + CSV export | M |
| 8 | Funnel page (stage dwell, model/source layers) | M |
| 9 | URL state binding + shareable links + PNG export | M |
| 10 | Report/PDF page (print CSS) | S |
| 11 | AI Assistant: `curated.ts` (20 intents) + `context.ts` + `/ask` UI + chat panel | L |
| 12 | LLM adapter (`llm.ts`) with offline fallback; wire env key | M |
| 13 | Polish: responsive, dark theme, empty states, a11y | M |
| 14 | Tests for engine (metrics, forecast, anomalies) + curated-intent coverage + `DECISIONS.md` | M |

Total ≈ 14 working chunks; engine (2/4/5) sequenced first since everything renders it.

---

## 10. Risks & mitigations
- **Small samples per rep/branch/month** → percentile thresholds + minimum-count guards on anomalies.
- **No live backend** → "real-time" is simulated via dynamic recomputation over as-of date; documented honestly.
- **LLM may hallucinate numbers** → mitigated by grounding: LLM narrates engine-computed metrics only (never raw math). Curated intents are answerable offline via the deterministic engine.
- **Rule-engine summaries risk sounding formulaic** → rich metric deltas + threshold tiers keep them informative; LLM slot ready.
- **Weighted-conversion constants** could be arbitrary → derive from dataset transitions; fall back to sensible defaults flagged in UI as "model estimate."

---

## 11. Immediate next steps
1. Confirm this plan (or adjust scope/ordering).
2. Scaffold project; begin Step 1–2 (shell + data engine).
3. Build engine-first so forecasts/alerts/summaries render real output by the first UI milestone.