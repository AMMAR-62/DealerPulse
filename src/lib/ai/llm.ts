import type { AIContext } from "./context";
import {
  CURATED_QUESTIONS,
  resolveIntent,
  type IntentKey,
  type IntentAnswer,
} from "./curated";

export interface LlmConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function getLlmConfig(): LlmConfig | null {
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl:
      process.env.LLM_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      "https://api.openai.com/v1",
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
  };
}

export function isLlmConfigured(): boolean {
  return Boolean(getLlmConfig());
}

export interface LlmResponse {
  text: string;
  mode: "llm" | "offline";
  intent?: IntentKey;
  table?: IntentAnswer["table"];
}

function buildSystemPrompt(ctx: AIContext): string {
  const scope = `${ctx.scope.role} view` +
    (ctx.scope.branches.length ? ` · branches: ${ctx.scope.branches.join(",")}` : "") +
    (ctx.scope.reps.length ? ` · reps: ${ctx.scope.reps.join(",")}` : "");
  const kpis = ctx.kpis;
  const lines = [
    "You are DealerPulse, an analytics assistant for a car dealership network.",
    "Answer ONLY from the provided metrics context. Never invent numbers.",
    "Give precise figures (counts, percentages, currency) from the data.",
    "Be concise but concrete; cite the numbers you use.",
    `Scope: ${scope}. As of: ${ctx.asOf}.`,
    "",
    `KPIs: ${kpis.totalLeads} leads, ${kpis.deliveredUnits} delivered (${(kpis.deliveryRate * 100).toFixed(1)}%), ${kpis.lostLeads} lost (${(kpis.lostRate * 100).toFixed(1)}%), ${kpis.openLeads} open, revenue ₹${Math.round(kpis.revenueToDate).toLocaleString("en-IN")}, avg days-to-deliver ${kpis.avgDaysToDeliver.toFixed(1)}, delayed deliveries ${kpis.delayedDeliveries}.`,
    `Forecast: projected ${Math.round(ctx.forecast.projectedEndUnits)} vs plan ${Math.round(ctx.forecast.targetEndUnits)} by ${ctx.forecast.horizonMonth} (gap ${Math.round(ctx.forecast.endGap)}), expected wins ahead ${Math.round(ctx.forecast.expectedWinsAhead)}, required/month ${ctx.forecast.requiredPerMonth.toFixed(1)}.`,
  ];

  if (ctx.funnel.length) {
    lines.push("", "Funnel (current / reached): " + ctx.funnel.map((f) => `${f.stage.replace("_", " ")} ${f.current}/${f.reached}`).join(" · "));
  }
  if (ctx.conversion.length) {
    lines.push("Conversion: " + ctx.conversion.map((c) => `${c.from.replace("_", " ")}→${c.to.replace("_", " ")} ${(c.rate * 100).toFixed(1)}% (${c.toCount}/${c.fromCount})`).join(" · "));
  }
  if (ctx.dwell.length) {
    lines.push("Dwell avg days: " + ctx.dwell.map((d) => `${d.stage.replace("_", " ")} ${d.avgDays.toFixed(1)}`).join(" · "));
  }

  if (ctx.branches.length) {
    lines.push("", "Branches (leads / delivered / rate / target / Δ / revenue):");
    for (const b of ctx.branches) {
      lines.push(`- ${b.name}: ${b.leads}/${b.deliveredUnits} (${(b.deliveryRate * 100).toFixed(1)}%) target ${b.targetUnits} units Δ ${b.deliveredVsTarget >= 0 ? "+" : ""}${b.deliveredVsTarget} revenue ₹${Math.round(b.revenue).toLocaleString("en-IN")} avgDays ${b.avgDaysToDeliver.toFixed(1)}`);
    }
  }

  if (ctx.reps.length) {
    lines.push("", "Reps (leads / delivered / rate / revenue / idle days):");
    for (const r of ctx.reps.slice(0, 30)) {
      lines.push(`- ${r.name} (${r.branchName}): ${r.leads}/${r.deliveredUnits} (${(r.deliveryRate * 100).toFixed(1)}%) rev ₹${Math.round(r.revenue).toLocaleString("en-IN")} idle ${r.daysSinceLastActivity}d`);
    }
  }

  if (ctx.sources.length) {
    lines.push("", "Sources (leads / delivered% / lost% / revenue): " + ctx.sources.map((s) => `${s.source} ${s.leads}/${(s.deliveredRate * 100).toFixed(1)}%/${(s.lostRate * 100).toFixed(1)}% ₹${Math.round(s.revenue).toLocaleString("en-IN")}`).join(" · "));
  }
  if (ctx.models.length) {
    lines.push("Models (leads / delivered% / revenue / avgDays): " + ctx.models.map((m) => `${m.model} ${m.leads}/${(m.deliveryRate * 100).toFixed(1)}% ₹${Math.round(m.revenue).toLocaleString("en-IN")}/${m.avgDaysToDeliver.toFixed(1)}d`).join(" · "));
  }
  if (ctx.lostReasons.length) {
    lines.push("Lost reasons: " + ctx.lostReasons.map((r) => `${r.reason} ${r.count}`).join(" · "));
  }
  if (ctx.delayReasons.length) {
    lines.push("Delay causes: " + ctx.delayReasons.map((r) => `${r.reason} ${r.count}`).join(" · "));
  }
  if (ctx.branchPipeline.length) {
    lines.push("Weighted pipeline by branch: " + ctx.branchPipeline.map((b) => `${b.branchName} ₹${Math.round(b.weightedValue).toLocaleString("en-IN")} (${b.openLeads} open)`).join(" · "));
  }
  if (ctx.staleLeads.length) {
    lines.push(`Stale open leads (14+ days idle): ${ctx.staleLeads.length}.`);
  }
  if (ctx.atRiskClose.length) {
    lines.push(`At-risk close leads (due within 30 days): ${ctx.atRiskClose.length} — ${ctx.atRiskClose.slice(0, 8).map((l) => `${l.leadId} (${l.customer}, due ${l.expectedClose}, idle ${l.daysSinceActivity}d)`).join("; ")}.`);
  }

  if (ctx.anomalies.length) {
    lines.push("", "Anomalies: " + ctx.anomalies.slice(0, 8).map((a) => a.reason).join("\n- "));
  }
  if (ctx.alerts.length) {
    lines.push("", "Top alerts: " + ctx.alerts.slice(0, 6).map((a) => a.reason).join("\n- "));
  }
  if (ctx.monthly.length) {
    lines.push("", "Monthly (delivered / lost / target): " + ctx.monthly.map((m) => `${m.month} ${m.deliveredUnits}/${m.lostUnits}/${m.targetUnits}`).join(" · "));
  }

  return lines.join("\n");
}

async function callLlm(
  config: LlmConfig,
  system: string,
  question: string
): Promise<string> {
  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: question },
      ],
      temperature: 0.3,
      max_tokens: 700,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LLM request failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("LLM response missing content.");
  return text.trim();
}

function normalize(value: string): string {
  const common: Record<string, string> = {
    "test drive": "test_drive",
    "test-drive": "test_drive",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };
  return value.toLowerCase().replace(/[?.!,]/g, "").split(/\s+/).map((w) => common[w] ?? w).join(" ");
}

const KEYWORD_MAP: { intents: IntentKey[]; keywords: string[] }[] = [
  { intents: ["branch_target_pacing"], keywords: ["behind", "ahead", "target", "monthly unit"] },
  { intents: ["month_end_projection"], keywords: ["projected", "month-end", "month end", "best/expected", "worst", "attainment"] },
  { intents: ["branch_delivery_trend"], keywords: ["trend", "improving", "deteriorating", "flat"] },
  { intents: ["top_reps"], keywords: ["closes the most", "most units", "best conversion", "top rep", "highest conversion", "best at conversion", "top performing"] },
  { intents: ["coaching_opportunity"], keywords: ["coaching", "high-volume", "low-converting", "high volume"] },
  { intents: ["stale_leads_by_rep"], keywords: ["stale", "unfollowed", "no follow-up", "no follow up", "follow-up"] },
  { intents: ["rep_peer_anomalies"], keywords: ["over- or under-perform", "over perform", "under perform", "anomaly", "peers"] },
  { intents: ["biggest_dropoff"], keywords: ["biggest drop-off", "drop-off", "drop off", "dropoff", "funnel stage", "stage has"] },
  { intents: ["stage_dwell"], keywords: ["dwell", "long do leads spend", "benchmark", "stage drag", "drag"] },
  { intents: ["source_roi"], keywords: ["source", "walk_in", "walk-in", "website", "referral", "channel"] },
  { intents: ["model_performance"], keywords: ["model", "models sell", "revenue share", "deal value", "sell best"] },
  { intents: ["lost_reasons_by_branch"], keywords: ["top reasons", "lost", "reasons.", "by branch", "why"] },
  { intents: ["lost_reason_correlation"], keywords: ["correlate", "dissatisfaction", "fortuner"] },
  { intents: ["at_risk_close"], keywords: ["at risk", "expected_close_date", "expected close", "missing"] },
  { intents: ["aged_no_followup"], keywords: ["aged", "aging", "without any follow-up", "idle"] },
  { intents: ["days_to_deliver_by_branch"], keywords: ["days-to-deliver", "days to deliver", "slowest branch", "slowest"] },
  { intents: ["delay_causes"], keywords: ["delay", "delayed", "logistics", "allocation", "finance"] },
  { intents: ["slowest_models"], keywords: ["take longest", "longest to deliver"] },
  { intents: ["weighted_pipeline_by_branch"], keywords: ["pipeline value", "weighted", "open pipeline", "weighted by stage"] },
  { intents: ["monthly_conversion_strength"], keywords: ["which month", "strongest", "weakest", "month had"] },
];

export function matchIntent(question: string): IntentKey | null {
  const q = normalize(question);
  let best: { intent: IntentKey; score: number } | null = null;
  for (const rule of KEYWORD_MAP) {
    const score = rule.keywords.reduce(
      (s, k) => s + (q.includes(normalize(k)) ? 1 : 0),
      0
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { intent: rule.intents[0], score };
    }
  }
  return best?.score ? best.intent : null;
}

export async function answerQuestion(
  question: string,
  ctx: AIContext,
  forceOffline = false
): Promise<LlmResponse> {
  const config = forceOffline ? null : getLlmConfig();

  if (config) {
    try {
      const text = await callLlm(config, buildSystemPrompt(ctx), question);
      return { text, mode: "llm" };
    } catch {
      // fall through to the deterministic engine
    }
  }

  const intent = matchIntent(question);
  if (intent) {
    const answer = resolveIntent(intent, ctx);
    return { text: answer.text, mode: "offline", intent, table: answer.table };
  }

  return {
    text: "I can answer the 20 curated questions offline (see the picker). For free-form questions, add an LLM API key. Ask me about branch pacing, reps, funnel, lost leads, delivery, or the forecast.",
    mode: "offline",
  };
}

export { CURATED_QUESTIONS, resolveIntent };
export type { IntentKey };