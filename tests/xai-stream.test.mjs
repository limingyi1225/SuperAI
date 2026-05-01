import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildXAIUserContent,
    buildXAITools,
    streamXAIResponse,
} from '../lib/xai.ts';

test('buildXAITools enables web_search and x_search', () => {
    const fakeProvider = {
        tools: {
            webSearch: () => 'web-search-tool',
            xSearch: () => 'x-search-tool',
        },
    };

    const tools = buildXAITools(fakeProvider);

    assert.deepEqual(tools, {
        web_search: 'web-search-tool',
        x_search: 'x-search-tool',
    });
});

test('buildXAIUserContent preserves multimodal inputs and normalizes raw pdf payloads', () => {
    assert.deepEqual(
        buildXAIUserContent({
            text: 'Analyze these attachments',
            images: ['data:image/png;base64,abc123'],
            pdfs: ['raw-pdf-base64'],
        }),
        [
            { type: 'text', text: 'Analyze these attachments' },
            { type: 'image', image: 'data:image/png;base64,abc123' },
            {
                type: 'file',
                data: 'data:application/pdf;base64,raw-pdf-base64',
                mediaType: 'application/pdf',
                filename: 'document.pdf',
            },
        ]
    );
});

test('buildXAIUserContent uses fallback prompt for attachment-only requests', () => {
    assert.deepEqual(
        buildXAIUserContent({
            text: '   ',
            images: ['raw-image-base64'],
            pdfs: [],
            fallbackText: 'Read the image and answer.',
        }),
        [
            { type: 'text', text: 'Read the image and answer.' },
            { type: 'image', image: 'data:image/jpeg;base64,raw-image-base64' },
        ]
    );
});

test('streamXAIResponse throws when XAI_API_KEY is missing', async () => {
    const originalApiKey = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;

    try {
        await assert.rejects(
            async () => {
                for await (const event of streamXAIResponse(
                    [{ role: 'user', content: 'Hello' }],
                    'grok-4.3-latest'
                )) {
                    throw new Error(`Unexpected stream event: ${JSON.stringify(event)}`);
                }
            },
            /XAI_API_KEY/
        );
    } finally {
        if (originalApiKey === undefined) {
            delete process.env.XAI_API_KEY;
        } else {
            process.env.XAI_API_KEY = originalApiKey;
        }
    }
});

test('streamXAIResponse yields answer deltas without reasoning summary events', async () => {
    const originalApiKey = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = 'test-key';

    try {
        const events = [];
        const fakeRunner = async () => ({
            fullStream: (async function* () {
                yield { type: 'text-start', id: 'text-1' };
                yield { type: 'text-delta', delta: 'alpha' };
                yield { type: 'text-delta', delta: ' beta' };
                yield { type: 'text-end', id: 'text-1' };
            })(),
        });

        for await (const event of streamXAIResponse(
            [{ role: 'user', content: 'Hello' }],
            'grok-4.3-latest',
            undefined,
            fakeRunner,
            {
                responses: () => 'fake-model',
                tools: {
                    webSearch: () => 'web-search-tool',
                    xSearch: () => 'x-search-tool',
                },
            }
        )) {
            events.push(event);
        }

        assert.deepEqual(events, [
            { type: 'answer_delta', content: 'alpha' },
            { type: 'answer_delta', content: ' beta' },
        ]);
    } finally {
        if (originalApiKey === undefined) {
            delete process.env.XAI_API_KEY;
        } else {
            process.env.XAI_API_KEY = originalApiKey;
        }
    }
});

test('streamXAIResponse forwards text reasoning summary events from fullStream', async () => {
    const originalApiKey = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = 'test-key';

    try {
        const events = [];
        let capturedRequest;
        const fakeRunner = async (request) => {
            capturedRequest = request;
            return {
                fullStream: (async function* () {
                    yield { type: 'reasoning-start', id: 'reasoning-1' };
                    yield { type: 'reasoning-delta', delta: 'first thought' };
                    yield { type: 'reasoning-end', id: 'reasoning-1' };
                    yield { type: 'text-start', id: 'text-1' };
                    yield { type: 'text-delta', delta: 'final answer' };
                    yield { type: 'text-end', id: 'text-1' };
                })(),
            };
        };

        for await (const event of streamXAIResponse(
            [{ role: 'user', content: 'Analyze this problem carefully' }],
            'grok-4.3-latest',
            undefined,
            fakeRunner,
            {
                responses: () => 'fake-model',
                tools: {
                    webSearch: () => 'web-search-tool',
                    xSearch: () => 'x-search-tool',
                },
            }
        )) {
            events.push(event);
        }

        assert.deepEqual(capturedRequest.messages, [
            {
                role: 'user',
                content: 'Analyze this problem carefully',
            },
        ]);
        assert.equal(capturedRequest.providerOptions, undefined);

        assert.deepEqual(events, [
            { type: 'reasoning_summary_delta', content: 'first thought' },
            { type: 'reasoning_summary_done' },
            { type: 'answer_delta', content: 'final answer' },
        ]);
    } finally {
        if (originalApiKey === undefined) {
            delete process.env.XAI_API_KEY;
        } else {
            process.env.XAI_API_KEY = originalApiKey;
        }
    }
});

test('streamXAIResponse uses direct xAI responses flow for pdf attachments', async () => {
    const originalApiKey = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = 'test-key';

    try {
        const events = [];
        let sdkRunnerCalled = false;
        let capturedDirectRequest;
        const fakeRunner = async () => {
            sdkRunnerCalled = true;
            return {
                fullStream: (async function* () {})(),
            };
        };
        const fakeDirectRunner = async function* (request) {
            capturedDirectRequest = request;
            yield { type: 'answer_delta', content: 'pdf answer' };
        };

        for await (const event of streamXAIResponse(
            [{
                role: 'user',
                content: buildXAIUserContent({
                    text: 'Summarize this PDF',
                    pdfs: ['pdf-base64'],
                }),
            }],
            'grok-4.3-latest',
            'system prompt',
            fakeRunner,
            undefined,
            fakeDirectRunner
        )) {
            events.push(event);
        }

        assert.equal(sdkRunnerCalled, false);
        assert.deepEqual(capturedDirectRequest, {
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'Summarize this PDF' },
                    {
                        type: 'file',
                        data: 'data:application/pdf;base64,pdf-base64',
                        mediaType: 'application/pdf',
                        filename: 'document.pdf',
                    },
                ],
            }],
            model: 'grok-4.3-latest',
            systemInstruction: 'system prompt',
        });
        assert.deepEqual(events, [
            { type: 'answer_delta', content: 'pdf answer' },
        ]);
    } finally {
        if (originalApiKey === undefined) {
            delete process.env.XAI_API_KEY;
        } else {
            process.env.XAI_API_KEY = originalApiKey;
        }
    }
});
