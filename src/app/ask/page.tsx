import { parseSearchParams } from "@/lib/store/filters";
import { isLlmConfigured } from "@/lib/ai/llm";
import ChatPanel from "@/components/ChatPanel";

export default async function AskPage({
  searchParams,
}: PageProps<"/ask">) {
  const params = await searchParams;
  const filters = parseSearchParams(params);
  const initialQuestion =
    typeof params.q === "string" && params.q.trim()
      ? params.q.trim()
      : undefined;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
        <p className="text-sm text-zinc-500">
          Answers are grounded in computed metrics, scoped to your filters
          (as of {filters.asOf}){" "}
          {isLlmConfigured() ? "· LLM mode active" : "· deterministic engine mode"}
        </p>
      </div>
      <ChatPanel initialQuestion={initialQuestion} />
    </div>
  );
}