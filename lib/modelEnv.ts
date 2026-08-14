import { normalizeModelId } from './models.ts';

// Single source of truth for every model id that an environment variable can
// override. Production runs with its own .env.local (excluded from rsync), so a
// default changed here is NOT live until that file agrees — scripts/check-model-env.mjs
// compares the two and fails the deploy on any drift.
export interface ModelEnvOverride {
    /** Env var that selects the model. */
    key: string;
    /** Older env var still honored as a fallback, if any. */
    legacyKey?: string;
    /** The id the code ships with when nothing overrides it. */
    codeDefault: string;
    /** Human label used in check output. */
    label: string;
}

export const MODEL_ENV_OVERRIDES: ModelEnvOverride[] = [
    { key: 'GEMINI_MODEL', codeDefault: 'gemini-3.7-flash', label: 'Gemini' },
    { key: 'CLAUDE_MODEL_OPUS', legacyKey: 'CLAUDE_MODEL', codeDefault: 'claude-opus-5', label: 'Claude Opus' },
    { key: 'CLAUDE_MODEL_FABLE', legacyKey: 'CLAUDE_MODEL', codeDefault: 'claude-fable-5', label: 'Claude Fable' },
    { key: 'OPENAI_MODEL_TITLE', codeDefault: 'gpt-5.6-luna', label: 'OpenAI title generator' },
];

type EnvSource = Record<string, string | undefined>;

function findOverride(key: string): ModelEnvOverride {
    const override = MODEL_ENV_OVERRIDES.find(entry => entry.key === key);
    if (!override) throw new Error(`Unknown model env override: ${key}`);
    return override;
}

/** Resolve the model id for an override key: env value, legacy env value, then the code default. */
export function resolveModelEnv(key: string, env: EnvSource = process.env): string {
    const override = findOverride(key);
    const direct = env[override.key]?.trim();
    if (direct) return direct;

    const legacy = override.legacyKey ? env[override.legacyKey]?.trim() : undefined;
    if (legacy) return legacy;

    return override.codeDefault;
}

export type ModelEnvIssueKind = 'retired' | 'drift';

export interface ModelEnvIssue {
    key: string;
    label: string;
    envValue: string;
    codeDefault: string;
    kind: ModelEnvIssueKind;
    message: string;
    /** What to change to clear the issue. */
    suggestion: string;
}

/**
 * Report every model override whose env value disagrees with the code default.
 * Any disagreement is an issue: it means the deployed app runs a different model
 * than this checkout says it does.
 */
export function checkModelEnvOverrides(env: EnvSource): ModelEnvIssue[] {
    const issues: ModelEnvIssue[] = [];
    // A legacy key can back several overrides (CLAUDE_MODEL covers both Claude
    // presets), so collect the defaults it shadows and report the key once.
    const keyOwners = new Map<string, ModelEnvOverride[]>();

    for (const override of MODEL_ENV_OVERRIDES) {
        for (const key of [override.key, override.legacyKey]) {
            if (!key) continue;
            keyOwners.set(key, [...(keyOwners.get(key) ?? []), override]);
        }
    }

    for (const [key, owners] of keyOwners) {
        const envValue = env[key]?.trim();
        if (!envValue) continue;

        const expected = [...new Set(owners.map(owner => owner.codeDefault))];
        if (expected.includes(envValue)) continue;

        const canonical = normalizeModelId(envValue);
        const retired = canonical !== envValue;
        const expectedText = expected.join(' / ');
        // Pinning the catch-all key to one id would also force the other presets
        // onto it, so point at the specific keys instead.
        const isLegacyKey = owners.some(owner => owner.legacyKey === key);
        const suggestion = isLegacyKey
            ? `remove ${key} and set ${owners.map(owner => owner.key).join(' / ')} explicitly, or update the code defaults in lib/modelEnv.ts`
            : `set ${key}=${expected[0]} there, or update the code default in lib/modelEnv.ts`;

        issues.push({
            suggestion,
            key,
            label: owners.map(owner => owner.label).join(' / '),
            envValue,
            codeDefault: expected[0],
            kind: retired ? 'retired' : 'drift',
            message: retired
                ? `${key}=${envValue} is a retired id (now ${canonical}); the code default is ${expectedText}`
                : `${key}=${envValue} overrides the code default ${expectedText}`,
        });
    }

    return issues;
}

/** Parse a dotenv-style file body into a plain object. Ignores comments and blank lines. */
export function parseEnvFile(contents: string): Record<string, string> {
    const env: Record<string, string> = {};

    for (const rawLine of contents.split('\n')) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        const separator = line.indexOf('=');
        if (separator === -1) continue;

        const key = line.slice(0, separator).trim().replace(/^export\s+/, '');
        let value = line.slice(separator + 1).trim();

        const quoted = (value.startsWith('"') && value.endsWith('"') && value.length > 1)
            || (value.startsWith("'") && value.endsWith("'") && value.length > 1);

        if (quoted) {
            value = value.slice(1, -1);
        } else {
            // `KEY=value   # note` — an unquoted trailing comment is not part of the value.
            value = value.replace(/\s+#.*$/, '').trim();
        }

        if (key) env[key] = value;
    }

    return env;
}
