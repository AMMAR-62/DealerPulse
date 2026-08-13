# DealerPulse — Engineering Decision Record

**Prepared for:** Leadership review
**Prepared by:** FDE
**Project:** Real-time dealership performance dashboard
**Data:** Synthetic dataset — 5 branches, 30 sales reps, 510 leads (Jun 1 – Dec 31, 2025)

---

## Executive summary

DealerPulse is a dealership performance analytics product that turns a single sales dataset into
dashboards, alerts, forecasts, and an AI assistant. Every decision below was made to answer three
business questions: *"What is happening?", "Why is it happening?"*, and *"What should we do next?"* —
while keeping the product honest, fast, and safe to hand to real users.

The guiding principles were:

1. **Single source of truth** — one dataset, one filter bar, one "as-of" date across every view.
2. **Explainable analytics** — every number on screen can be traced back to the data; nothing is vibes.
3. **Deterministic core, AI on top** — the AI narrates real metrics instead of inventing them.
4. **Shareable by design** — filters and even AI questions live in the URL, so views and findings are linkable.

---

## 1. Point-in-time analytics over a static dataset

**Decision:** All analysis runs over one imported dataset (`dealership_data.json`) with a user-selectable
"as-of" date, rather than connecting to a live back end.

**Why:** The dataset is a single source of truth for the proof-of-concept, so there is nothing to sync
and no API contracts to maintain. The synthetic data carries full history, so a point-in-time model
lets us demonstrate the most valuable feature — scrubbing the clock back (e.g., "what did October look
like?") — without needing a real database. This keeps the core truthful: an "as-of" reconstruction is
always reproducible, which is exactly what a manager reviewing October's numbers expects.

**Result:** Every page is a pure function of `(data, filters, as-of date)`. The same input always
produces the same output.

---

## 2. URL-bound filters instead of app state

**Decision:** The global scope — role, branches, reps, sources, models, date range, and as-of date — is
encoded in the URL query string. There is no hidden in-memory state.

**Why:** In a reporting tool, a view is a finding. If a branch manager discovers "Lakeside is behind 15
units", they should be able to paste that exact view into a message and have the recipient see the same
numbers. URL state also makes back/forward buttons and bookmarks work for free, and removes a whole class
of state-synchronization bugs.

**Result:** Shareable links with one click; the AI assistant even stores its last question as a URL
parameter so a link can replay the same ask.

---

## 3. Role-based default scoping

**Decision:** A role switcher (CEO / Branch Manager / Rep) scopes what a viewer sees. A manager defaults
to a single branch; a rep defaults to their own pipeline. A rep's scope is always locked to their branch.

**Why:** A dashboard that shows every branch to every rep would leak data and overwhelm them with
irrelevant numbers. Defaulting a manager to one branch prevents the accidental "I showed the whole
network to a branch manager" mistake. Context matters more than breadth.

**Details:** The default rep is chosen as the first rep with actual leads — the natural first pick
("SR1") has zero leads, which produced an empty dashboard that looked broken. This was found by the test
suite and fixed.

---

## 4. Funnel that tracks both "current" and "reached"

**Decision:** The funnel reports two numbers per stage — leads **currently** in that stage and leads that
ever **reached** it — and treats "lost" as a terminal exit, not a stage in the linear progression.

**Why:** A single "is it in this stage right now?" number hides conversions that happened months ago.
"Reached" reveals the true shape of the funnel (e.g., 510 leads entered, only 160 delivered). Keeping
"lost" separate stops it distorting stage-to-stage conversion math.

**One metric it surfaced:** conversion drops most at new→contacted (76.7%) and order_placed→delivered
(80.8%) — clear pointers for follow-up discipline and fulfillment.

---

## 5. "Gap vs plan" = cumulative attainment, not a forward target

**Decision:** The forecast's headline number is **plan attainment to date** (delivered units vs the
cumulative plan), not a projected future target.

**Why:** "We've delivered 160 of the 1,426 units planned so far" is a hard, verifiable fact. A
forward-looking prediction invites assumptions about the future that can be challenged for the wrong
reasons. Reporting attainment keeps every number auditable while still showing the projected path via
best/expected/worst bands.

---

## 6. Forecast uses data-derived stage probabilities

**Decision:** Best/expected/worst forecast bands are computed from stage-transition probabilities learned
from the dataset itself (e.g., new→contacted = 76.7%, order_placed→delivered = 80.8%).

**Why:** Hardcoded industry guesses ("new leads convert at 20%") would have no connection to this data.
Learning the probabilities from the actual history means the forecast reflects *this* dealership's
behavior, not a generic average — and the model wires into the AI assistant so both share the same
numbers.

---

## 7. Anomaly detection that combines statistics and common sense

**Decision:** An entity (branch/rep/source) is flagged when it is a statistical outlier versus its peers
(z-score beyond a threshold) **or** when it is radically off the peer average in relative terms (≤ half
or ≥ 1.5× the average).

**Why:** Pure statistics alone would have missed Lakeside's failure — its delivery rate (7.6% vs the
30.1% network average) had a z-score below the flag threshold only because the small sample set made the
variance look normal. The relative-ratio rule catches "this is obviously far from everyone else" even
when statistics need more data.

**Guardrail:** A minimum-sample size prevents alerts from firing on tiny, statistically meaningless
groups.

---

## 8. Rule-based alerts with dismissible state

**Decision:** Alerts are generated by deterministic rules (aging, follow-up risk, pipeline risk, delivery
risk, anomalies) with severity tiers, and dismissals are remembered on the viewer's device.

**Why:** Deterministic rules mean the same data yields the same alerts every time — reviewable and
explainable. Severity tiers let a busy manager prioritize without reading everything. Persisting
dismissals stops the same alert nagging on every visit, while keeping the underlying data untouched.

---

## 9. Server components by default, client only where interactive

**Decision:** Pages render on the server; interactive components (filter bar, charts, theme toggle,
lead drawer, print button, chat panel) are the only client-side pieces.

**Why:** Server rendering keeps page loads fast, keeps data processing off the user's device, and avoids
leaking raw dataset details to the browser bundle. Interactivity is isolated, so the codebase stays
simple and each page is just a pure function of the URL.

**Why not a full client-side app:** No state to sync, no loading skeletons to build, smaller bundle —
and the analytics logic is shared and testable regardless of where it renders.

---

## 10. Exports: CSV, PNG, print-ready PDF, shareable link

**Decision:** Each export uses the appropriate browser-native mechanism: CSV generated client-side for
tables, `html-to-image` for chart PNGs, and print CSS for the executive report PDF.

**Why:** PNG of a chart is a screenshot of what you see on screen. PDF via browser print means the report
is pixel-identical to the web page and needs no extra library or server. CSV keeps the data open for the
user's own tools. Each choice favors "works reliably with no extra moving parts."

**Result:** A leadership report can be generated as a real PDF with one click, with navigation chrome
automatically stripped in print.

---

## 11. Light/dark theme applied before first paint

**Decision:** The saved theme is applied via a tiny inline script before React renders, with a toggle in
the global filter bar.

**Why:** Applying the theme after render causes a visible flash (dark-mode users get a white flash every
page load) — a small but very visible quality issue. The pre-paint script eliminates it with no
measurable cost.

---

## 12. AI assistant: metrics-first, LLM-narrates, offline-capable

**Decision:** The AI assistant answers questions in three layers:
1. **Deterministic engine** — 20 curated questions map to computed-metric intents and are answered
   with real numbers, no model required.
2. **LLM with grounding** — when an API key is present, the model narrates a compact snapshot of the
   computed metrics (KPIs, branches, reps, sources, models, forecast, alerts).
3. **Graceful fallback** — if there is no key (or a call fails), the deterministic engine answers the
   curated set and keyword-matches free-form questions.

**Why:** The biggest risk with LLM dashboards is hallucination — the model inventing a "94%" that was
never in the data. By construction, the model never does math; it only *explains the numbers the engine
already computed*. The 20 curated questions are a guaranteed-quality baseline, so the product works
fully offline and only improves with a model connected.

**Why 20 fixed questions:** A finite, testable contract. We can prove in automated tests that all 20 are
answerable offline, so coverage is measurable, not aspirational.

**Security:** The API key is read server-side only; it never reaches the browser.

---

## 13. Currency and number conventions

**Decision:** Indian Rupee formatting (`en-IN`, ₹) for money, compact notation for large numbers in
cards.

**Why:** The dealership operates in INR and users will be local — ₹3,88,76,000 reads correctly and
immediately. Compact cards prevent overflow on small screens while the detailed views keep full
precision.

---

## 14. Verification loop baked into the workflow

**Decision:** Every change goes through `lint → build → 45 automated tests → production smoke test`
against live routes.

**Why:** A dashboard full of charts is worthless if a query param crashes the page. The test suite locks
in the numbers that matter (510 leads, 160 delivered, funnel ordering, forecast shape, all 20 AI
intents), and the smoke test proves the production build actually serves them.

---

## Open items / honest limitations

- **Cross-tab of lost reasons × source × model** resolves to the global loss table offline; the full
  crosstab is available in LLM mode. A richer offline crosstab is a straightforward follow-up.
- "Real-time" is simulated via as-of recomputation over a static dataset; a live feed is a future
  integration, and the architecture (pure functions over `(data, filters, asOf)`) is already shaped for it.
- The AI answer quality depends on the model's key/rate limits; the deterministic layer keeps the
  product functional regardless.