import { describe, expect, it } from "vitest";
import { getDataset, buildIndex } from "../data/load";
import { defaultFilters } from "../store/filters";
import { buildContext } from "./metrics";
import {
  computeForecast,
  computeMonthEndProjection,
  computePipelineBuckets,
} from "./pipeline";
import { computeAnomalies } from "./anomalies";
import { computeAlerts } from "./alerts";
import { generateSummary } from "./summaries";

const dataset = getDataset();
const index = buildIndex(dataset);

function ctxAll(asOf = "2025-12-31") {
  const filters = defaultFilters();
  filters.asOf = asOf;
  return buildContext(dataset, index, filters);
}

describe("computeForecast", () => {
  it("builds cumulative monotonic series", () => {
    const forecast = computeForecast(dataset, index, ctxAll());
    let prevCum = -Infinity;
    for (const p of forecast.points) {
      expect(p.actualCumulative).toBeGreaterThanOrEqual(prevCum);
      prevCum = p.actualCumulative;
      expect(p.projectedCumulative).toBeGreaterThanOrEqual(p.actualCumulative);
    }
    expect(forecast.points.length).toBeGreaterThanOrEqual(7);
  });

  it("computes the 11.2% year-end attainment case", () => {
    const forecast = computeForecast(dataset, index, ctxAll(), 6);
    const last = forecast.points[forecast.points.length - 1];
    expect(last.actualCumulative).toBe(160);
    expect(last.month).toBe("2025-12");
  });

  it("endGap is the projected shortfall vs plan", () => {
    const forecast = computeForecast(dataset, index, ctxAll());
    expect(forecast.endGap).toBeLessThan(0);
  });

  it("early as-of shrinks the actual window", () => {
    const oct = computeForecast(dataset, index, ctxAll("2025-10-31"));
    const actualMonths = oct.points.filter((p) => !p.isForecast).length;
    const full = computeForecast(dataset, index, ctxAll());
    const fullActual = full.points.filter((p) => !p.isForecast).length;
    expect(actualMonths).toBe(5); // Jun–Oct 2025
    expect(fullActual).toBe(7); // Jun–Dec 2025
  });

  it("month-end projection reports gap vs plan", () => {
    const forecast = computeForecast(dataset, index, ctxAll("2025-11-30"));
    const projection = computeMonthEndProjection(forecast);
    expect(projection.projected).toBeGreaterThan(0);
    expect(projection.gap).toBeLessThan(0);
  });
});

describe("computePipelineBuckets", () => {
  it("expected wins stay within the open-lead ceiling", () => {
    const forecast = computeForecast(dataset, index, ctxAll());
    const buckets = computePipelineBuckets(ctxAll().leads, forecast.probabilities);
    const openLeads = buckets.reduce((s, b) => s + b.leads, 0);
    const expectedWins = buckets.reduce((s, b) => s + b.expectedWins, 0);
    expect(openLeads).toBeGreaterThan(0);
    expect(expectedWins).toBeGreaterThanOrEqual(0);
    expect(expectedWins).toBeLessThanOrEqual(openLeads);
    for (const b of buckets) {
      expect(b.prob).toBeGreaterThanOrEqual(0);
      expect(b.prob).toBeLessThanOrEqual(1);
    }
  });

  it("probabilities are data-derived and in [0,1]", () => {
    const forecast = computeForecast(dataset, index, ctxAll());
    for (const prob of Object.values(forecast.probabilities)) {
      expect(prob).toBeGreaterThanOrEqual(0);
      expect(prob).toBeLessThanOrEqual(1);
    }
    expect(forecast.probabilities["order_placed"]).toBeGreaterThan(
      forecast.probabilities["new"]
    );
  });
});

describe("computeAnomalies", () => {
  it("flags Lakeside (B3) as a low-conversion outlier", () => {
    const flags = computeAnomalies(dataset, index, ctxAll());
    const b3 = flags.find((f) => f.entityId === "B3" && f.entityType === "branch");
    expect(b3).toBeDefined();
    expect(b3!.direction).toBe("low");
  });

  it("a high minSample silences peer-rate flags", () => {
    const flags = computeAnomalies(dataset, index, ctxAll(), { minSample: 1000 });
    const rateFlags = flags.filter((f) => f.metric === "delivery_rate");
    expect(rateFlags).toEqual([]);
  });
});

describe("computeAlerts", () => {
  it("always returns a well-formed result", () => {
    const forecast = computeForecast(dataset, index, ctxAll());
    const result = computeAlerts(dataset, index, ctxAll(), forecast);
    expect(Array.isArray(result.alerts)).toBe(true);
    expect(
      result.counts.critical + result.counts.warning + result.counts.info
    ).toBe(result.alerts.length);
  });
});

describe("generateSummary", () => {
  it("produces deterministic sections with bullets", () => {
    const forecast = computeForecast(dataset, index, ctxAll());
    const sections = generateSummary({ dataset, index, ctx: ctxAll(), forecast });
    expect(sections.length).toBeGreaterThan(0);
    const again = generateSummary({ dataset, index, ctx: ctxAll(), forecast });
    expect(sections).toEqual(again);
    for (const s of sections) {
      expect(s.bullets.length).toBeGreaterThan(0);
    }
  });
});