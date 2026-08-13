import { getDataset, buildIndex } from "@/lib/data/load";
import { parseSearchParams } from "@/lib/store/filters";
import { buildContext } from "@/lib/engine/metrics";
import { computeForecast } from "@/lib/engine/pipeline";
import { buildAIContext } from "@/lib/ai/context";
import { matchIntent, answerQuestion } from "@/lib/ai/llm";
import { resolveIntent } from "@/lib/ai/curated";

export async function POST(request: Request) {
  let body: {
    question?: string;
    intent?: string;
    filters?: Record<string, string | string[]>;
    mode?: "llm" | "engine" | "auto";
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question && typeof body.intent !== "string") {
    return Response.json({ error: "Missing question." }, { status: 400 });
  }

  const dataset = getDataset();
  const index = buildIndex(dataset);
  const filters = parseSearchParams(body.filters ?? {});
  const ctx = buildContext(dataset, index, filters);
  const forecast = computeForecast(dataset, index, ctx);
  const aiCtx = buildAIContext(dataset, index, ctx, forecast);

  if (typeof body.intent === "string") {
    try {
      const answer = resolveIntent(body.intent as never, aiCtx);
      return Response.json({ ...answer, mode: "offline", intent: body.intent });
    } catch {
      return Response.json({ error: "Unknown intent." }, { status: 400 });
    }
  }

  const hinted = matchIntent(question);
  const mode = body.mode ?? "auto";
  const result = await answerQuestion(question, aiCtx, mode === "engine");
  return Response.json({
    ...result,
    intent: result.intent ?? hinted,
  });
}