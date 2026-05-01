/**
 * Shared helpers for writing SSE events over a TransformStream writer
 * and for routing provider-agnostic stream events ("answer_delta",
 * "reasoning_summary_delta", "reasoning_summary_done") into the
 * frontend's canonical SSE event shape.
 */

export interface ProviderStreamEvent {
    type: 'answer_delta' | 'reasoning_summary_delta' | 'reasoning_summary_done';
    content?: string;
}

export type SSEWriter = WritableStreamDefaultWriter<Uint8Array>;

const encoder = new TextEncoder();

export async function writeSSE(writer: SSEWriter, payload: Record<string, unknown>): Promise<void> {
    try {
        await writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
    } catch {
        // Writer is closed/errored — likely client disconnected or another
        // parallel stream errored and tore down the writer. Swallow so
        // sibling Promise.all branches don't unwind through .catch.
    }
}

/**
 * Drives the reasoning-summary FSM shared by every provider branch in
 * app/api/ask/route.ts. Emits `reasoning_summary_start/chunk/done` and
 * forwards `answer_delta` chunks. Guarantees a single `reasoning_summary_done`
 * is emitted when any summary content has been seen.
 */
export async function pipeProviderEvents(
    writer: SSEWriter,
    modelId: string,
    events: AsyncIterable<ProviderStreamEvent>
): Promise<void> {
    let summaryStarted = false;
    let summaryDone = false;

    for await (const event of events) {
        if (event.type === 'answer_delta' && event.content) {
            await writeSSE(writer, { type: 'chunk', modelId, content: event.content });
            continue;
        }

        if (event.type === 'reasoning_summary_delta' && event.content) {
            if (!summaryStarted) {
                summaryStarted = true;
                await writeSSE(writer, { type: 'reasoning_summary_start', modelId });
            }
            await writeSSE(writer, { type: 'reasoning_summary_chunk', modelId, content: event.content });
            continue;
        }

        if (event.type === 'reasoning_summary_done' && summaryStarted && !summaryDone) {
            summaryDone = true;
            await writeSSE(writer, { type: 'reasoning_summary_done', modelId });
        }
    }

    if (summaryStarted && !summaryDone) {
        await writeSSE(writer, { type: 'reasoning_summary_done', modelId });
    }
}
