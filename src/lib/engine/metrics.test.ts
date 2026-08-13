import { describe, expect, it } from "vitest";
import { getDataset, buildIndex } from "../data/load";
import { defaultFilters } from "../store/filters";
import {
  buildContext,
  computeConversion,
  computeFunnel,
  computeKpis,
  computeLostByReason,
} from "./metrics";

const dataset = getDataset();
const index = buildIndex(dataset);

function ctxAll() {
  return buildContext(dataset, index, defaultFilters());
}

describe("dataset integrity", () => {
  it("has 5 branches, 30 reps, 510 leads", () => {
    expect(dataset.branches).toHaveLength(5);
    expect(dataset.sales_reps).toHaveLength(30);
    expect(dataset.leads).toHaveLength(510);
  });

  it("every lead maps to a known branch and rep", () => {
    for (const lead of dataset.leads) {
      expect(index.branchesById.has(lead.branch_id)).toBe(true);
      expect(index.repsById.has(lead.assigned_to)).toBe(true);
    }
  });

  it("every delivery maps to a delivered lead", () => {
    const delivered = new Set(
      dataset.leads.filter((l) => l.status === "delivered").map((l) => l.id)
    );
    for (const d of dataset.deliveries) {
      expect(delivered.has(d.lead_id)).toBe(true);
    }
    expect(dataset.deliveries.length).toBe(160);
  });
});

describe("computeKpis", () => {
  it("counts network units and revenue", () => {
    const k = computeKpis(ctxAll());
    expect(k.totalLeads).toBe(510);
    expect(k.deliveredUnits).toBe(160);
    expect(k.openLeads).toBe(62);
    expect(k.lostLeads).toBe(288);
    expect(k.deliveryRate).toBeCloseTo(160 / 510);
    expect(k.deliveredVsTarget).toBe(-58);
  });
});

describe("computeFunnel", () => {
  it("is non-increasing in reached counts across progression stages", () => {
    const funnel = computeFunnel(ctxAll().leads);
    const progression = funnel.filter((f) => f.stage !== "lost");
    const reached = progression.map((f) => f.reached);
    for (let i = 1; i < reached.length; i++) {
      expect(reached[i]).toBeLessThanOrEqual(reached[i - 1]);
    }
  });

  it("counts current leads per stage", () => {
    const funnel = new Map(
      computeFunnel(ctxAll().leads).map((f) => [f.stage, f.current])
    );
    expect(funnel.get("delivered")).toBe(160);
    expect(funnel.get("lost")).toBe(288);
  });
});

describe("computeConversion", () => {
  it("derives decreasing order-of-magnitude rates", () => {
    const conversion = computeConversion(ctxAll().leads);
    expect(conversion.length).toBeGreaterThan(0);
    for (const c of conversion) {
      expect(c.rate).toBeGreaterThanOrEqual(0);
      expect(c.rate).toBeLessThanOrEqual(1);
      expect(c.toCount).toBeLessThanOrEqual(c.fromCount);
    }
  });
});

describe("computeLostByReason", () => {
  it("reflects the lost-lead count", () => {
    const reasons = computeLostByReason(ctxAll().leads);
    const total = reasons.reduce((s, r) => s + r.count, 0);
    expect(total).toBe(288);
    expect(reasons.length).toBeGreaterThan(1);
  });
});

describe("buildContext scoping", () => {
  it("manager defaults to the first branch", () => {
    const filters = defaultFilters();
    filters.role = "manager";
    const ctx = buildContext(dataset, index, filters);
    for (const lead of ctx.leads) {
      expect(lead.branch_id).toBe(index.branchIds[0]);
    }
  });

  it("rep defaults to the first rep with leads and their branch only", () => {
    const filters = defaultFilters();
    filters.role = "rep";
    const ctx = buildContext(dataset, index, filters);
    const repId = ctx.filters.reps[0];
    const branchId = index.repsById.get(repId)!.branch_id;
    expect(ctx.leads.length).toBeGreaterThan(0);
    for (const lead of ctx.leads) {
      expect(lead.assigned_to).toBe(repId);
      expect(lead.branch_id).toBe(branchId);
    }
  });
});