import { describe, expect, it } from "vitest";
import {
  defaultFilters,
  filtersToParams,
  parseSearchParams,
  updateParam,
} from "./filters";

describe("parseSearchParams", () => {
  it("returns defaults when empty", () => {
    const f = parseSearchParams({});
    expect(f.role).toBe("ceo");
    expect(f.branches).toEqual([]);
    expect(f.asOf).toBe("2025-12-31");
  });

  it("parses lists from comma-separated strings", () => {
    const f = parseSearchParams({ branch: "B1, B2", rep: "SR1" });
    expect(f.branches).toEqual(["B1", "B2"]);
    expect(f.reps).toEqual(["SR1"]);
  });

  it("parses string arrays", () => {
    const f = parseSearchParams({ source: ["walk-in", "referral"] });
    expect(f.sources).toEqual(["walk-in", "referral"]);
  });

  it("rejects invalid dates", () => {
    const f = parseSearchParams({ from: "not-a-date", asof: "2025-13-40" });
    expect(f.from).toBe("2025-06-01");
    expect(f.asOf).toBe("2025-12-31");
  });

  it("accepts valid dates", () => {
    const f = parseSearchParams({ from: "2025-07-01", asof: "2025-10-31" });
    expect(f.from).toBe("2025-07-01");
    expect(f.asOf).toBe("2025-10-31");
  });

  it("accepts only known roles", () => {
    expect(parseSearchParams({ role: "manager" }).role).toBe("manager");
    expect(parseSearchParams({ role: "rep" }).role).toBe("rep");
    expect(parseSearchParams({ role: "nope" }).role).toBe("ceo");
  });
});

describe("filtersToParams", () => {
  it("omits defaults", () => {
    const params = filtersToParams(defaultFilters());
    expect(params).toEqual({});
  });

  it("serializes non-default values", () => {
    const f = defaultFilters();
    f.role = "manager";
    f.branches = ["B3"];
    f.asOf = "2025-09-30";
    const params = filtersToParams(f);
    expect(params).toEqual({
      role: "manager",
      branch: "B3",
      asof: "2025-09-30",
    });
  });
});

describe("round trip", () => {
  it("preserves values", () => {
    const original = {
      role: "rep" as const,
      branches: ["B1"],
      reps: ["SR2"],
      sources: ["referral"],
      models: [],
      from: "2025-06-01",
      to: "2025-12-31",
      asOf: "2025-11-30",
    };
    const parsed = parseSearchParams(filtersToParams(original));
    expect(parsed).toEqual(original);
  });
});

describe("updateParam", () => {
  it("replaces a key and coerces arrays to comma lists", () => {
    const next = updateParam(
      { branch: "B1", rep: ["SR1", "SR2"] },
      "branch",
      ["B2", "B3"]
    );
    expect(next.branch).toBe("B2,B3");
    expect(next.rep).toBe("SR1,SR2");
  });

  it("removes the key when the value is an empty list", () => {
    const next = updateParam({ branch: "B1" }, "branch", []);
    expect(next.branch).toBeUndefined();
  });

  it("removes the key when the value is empty string", () => {
    const next = updateParam({ branch: "B1" }, "branch", "");
    expect(next.branch).toBeUndefined();
  });
});