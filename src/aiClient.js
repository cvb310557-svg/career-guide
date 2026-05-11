const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

async function callLLM({ messages, temperature = 0.3, responseFormat = null }) {
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL || 'gpt-4o-mini';
    const baseUrl = (process.env.AI_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
    const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 60000);

    if (!apiKey || apiKey === 'your_api_key_here') {
        throw new Error('AI_API_KEY is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const body = {
            model,
            messages,
            temperature
        };

        if (responseFormat) {
            body.response_format = { type: responseFormat };
        }

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = payload.error?.message || payload.message || `AI request failed with ${response.status}`;
            throw new Error(message);
        }

        const content = payload.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('AI response is empty');
        }

        return content;
    } finally {
        clearTimeout(timeout);
    }
}

function parseJsonResponse(content) {
    if (typeof content !== 'string') return content || {};

    const cleaned = content
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

    try {
        return JSON.parse(cleaned);
    } catch (error) {
        const first = cleaned.indexOf('{');
        const last = cleaned.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
            return JSON.parse(cleaned.slice(first, last + 1));
        }
        throw error;
    }
}

module.exports = {
    callLLM,
    parseJsonResponse
};
