// Client-safe types shared by SessionContext, page.tsx, and the API route.
// Kept separate from `lib/systemPrompts.ts` so server-only prompt strings
// never get bundled into client chunks.

export type AssistantMode = 'solver' | 'general';

export function isAssistantMode(value: unknown): value is AssistantMode {
    return value === 'solver' || value === 'general';
}
