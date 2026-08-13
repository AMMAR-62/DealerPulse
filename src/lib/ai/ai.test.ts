import { describe, expect, it } from "vitest";
import { getDataset, buildIndex } from "../data/load";
import { defaultFilters } from "../store/filters";
import { buildContext } from "../engine/metrics";
import { computeForecast } from "../engine/pipeline";
import { buildAIContext } from "./context";
import { CURATED_QUESTIONS, INTENT_GROUPS, resolveIntent } from "./curated";
import { matchIntent } from "./llm";

const dataset = getDataset();
const index = buildIndex(dataset);

function aiCtx() {
  const filters = defaultFilters();
  const ctx = buildContext(dataset, index, filters);
  const forecast = computeForecast(dataset, index, ctx);
  return buildAIContext(dataset, index, ctx, forecast);
}

describe("curated intents", () => {
  it("has exactly 20 curated questions in 6 groups", () => {
    expect(CURATED_QUESTIONS).toHaveLength(20);
    expect(INTENT_GROUPS).toHaveLength(6);
  });

  it("all 20 questions map to a registered theme", () => {
    const themes = new Set(INTENT_GROUPS.map((g) => g.theme));
    for (const q of CURATED_QUESTIONS) {
      expect(themes.has(q.theme as (typeof themes extends Set<infer T> ? T : never))).toBe(true);
    }
  });

  it("resolves every intent to text without throwing", () => {
    const ctx = aiCtx();
    for (const q of CURATED_QUESTIONS) {
      const answer = resolveIntent(q.intent, ctx);
      expect(typeof answer.text).toBe("string");
      expect(answer.text.length).toBeGreaterThan(0);
      expect(q.intent).toBeTruthy();
    }
  });

  it("curated prompts are distinct", () => {
    const prompts = new Set(CURATED_QUESTIONS.map((q) => q.prompt));
    expect(prompts.size).toBe(20);
  });

  it("produces revenue figures for source ROI", () => {
    const ctx = aiCtx();
    const answer = resolveIntent("source_roi", ctx);
    expect(answer.table).toBeDefined();
    const revenueIndex = answer.table!.columns.indexOf("Revenue");
    expect(revenueIndex).toBeGreaterThan(-1);
    for (const row of answer.table!.rows) {
      expect(String(row[revenueIndex])).toMatch(/₹/);
    }
  });
});

describe("matchIntent", () => {
  const cases: [string, string][] = [
    ["which branches are behind target", "branch_target_pacing"],
    ["projected month-end best expected worst", "month_end_projection"],
    ["which rep closes the most units", "top_reps"],
    ["biggest drop-off in the funnel", "biggest_dropoff"],
    ["stale leads no follow-up", "stale_leads_by_rep"],
    ["which models sell best", "model_performance"],
  ];
  for (const [question, expected] of cases) {
    it(`matches "${question}" → ${expected}`, () => {
      expect(matchIntent(question)).toBe(expected);
    });
  }

  it("returns null for unrelated questions", () => {
    expect(matchIntent("what is the weather today")).toBeNull();
  });
});