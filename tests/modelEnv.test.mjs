import test from 'node:test';
import assert from 'node:assert/strict';

const { MODEL_ENV_OVERRIDES, resolveModelEnv, checkModelEnvOverrides, parseEnvFile } =
    await import('../lib/modelEnv.ts');

test('resolveModelEnv prefers the env value, then the legacy key, then the code default', () => {
    assert.equal(resolveModelEnv('GEMINI_MODEL', {}), 'gemini-3.7-flash');
    assert.equal(resolveModelEnv('GEMINI_MODEL', { GEMINI_MODEL: 'gemini-4.0-flash' }), 'gemini-4.0-flash');
    assert.equal(resolveModelEnv('GEMINI_MODEL', { GEMINI_MODEL: '  ' }), 'gemini-3.7-flash');
    assert.equal(resolveModelEnv('CLAUDE_MODEL_OPUS', { CLAUDE_MODEL: 'claude-legacy' }), 'claude-legacy');
    assert.equal(
        resolveModelEnv('CLAUDE_MODEL_OPUS', { CLAUDE_MODEL: 'claude-legacy', CLAUDE_MODEL_OPUS: 'claude-opus-6' }),
        'claude-opus-6'
    );
});

test('an env matching the code defaults reports no issues', () => {
    const env = Object.fromEntries(MODEL_ENV_OVERRIDES.map(o => [o.key, o.codeDefault]));
    assert.deepEqual(checkModelEnvOverrides(env), []);
    assert.deepEqual(checkModelEnvOverrides({}), []);
});

test('the production regression is caught: a server pinned to a retired Gemini id', () => {
    const issues = checkModelEnvOverrides({ GEMINI_MODEL: 'gemini-3.5-flash' });

    assert.equal(issues.length, 1);
    assert.equal(issues[0].key, 'GEMINI_MODEL');
    assert.equal(issues[0].kind, 'retired');
    assert.equal(issues[0].codeDefault, 'gemini-3.7-flash');
    assert.match(issues[0].message, /retired/);
});

test('an unknown-but-different id is reported as drift, not silently accepted', () => {
    const issues = checkModelEnvOverrides({ OPENAI_MODEL_TITLE: 'gpt-4o-mini' });

    assert.equal(issues.length, 1);
    assert.equal(issues[0].kind, 'drift');
    assert.equal(issues[0].codeDefault, 'gpt-5.6-luna');
});

test('the legacy CLAUDE_MODEL key is checked too', () => {
    const issues = checkModelEnvOverrides({ CLAUDE_MODEL: 'claude-opus-4-6' });
    assert.ok(issues.length > 0);
    assert.ok(issues.every(issue => issue.key === 'CLAUDE_MODEL'));
});

test('parseEnvFile ignores comments and blanks and strips quotes', () => {
    const env = parseEnvFile([
        '# comment',
        '',
        'GEMINI_MODEL=gemini-3.7-flash',
        'export CLAUDE_MODEL_OPUS="claude-opus-5"',
        "AUTH_USERS='a:b,c:d'",
        'NOT_AN_ASSIGNMENT',
    ].join('\n'));

    assert.equal(env.GEMINI_MODEL, 'gemini-3.7-flash');
    assert.equal(env.CLAUDE_MODEL_OPUS, 'claude-opus-5');
    assert.equal(env.AUTH_USERS, 'a:b,c:d');
    assert.equal(env.NOT_AN_ASSIGNMENT, undefined);
});

test('every override default is a model the code actually ships', async () => {
    const { AVAILABLE_MODELS, normalizeModelId } = await import('../lib/models.ts');
    const shipped = new Set(AVAILABLE_MODELS.map(m => m.id));

    for (const override of MODEL_ENV_OVERRIDES) {
        assert.equal(
            normalizeModelId(override.codeDefault),
            override.codeDefault,
            `${override.key} default ${override.codeDefault} is a retired id`
        );
        if (override.key !== 'OPENAI_MODEL_TITLE') {
            assert.ok(shipped.has(override.codeDefault), `${override.codeDefault} is not in AVAILABLE_MODELS`);
        }
    }
});
