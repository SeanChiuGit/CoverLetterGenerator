/**
 * Multi-Provider API Support
 * Supports OpenAI, OpenRouter, Groq, Anthropic, Gemini, DeepSeek, Together.ai
 */

const API_PROVIDERS = {
    openai: {
        name: "OpenAI",
        baseUrl: "https://api.openai.com/v1/chat/completions",
        defaultModel: "gpt-4o-mini",
        keyPrefix: "sk-",
        headerFormat: "bearer",
        requestFormat: "openai"
    },
    openrouter: {
        name: "OpenRouter",
        baseUrl: "https://openrouter.ai/api/v1/chat/completions",
        defaultModel: "openai/gpt-4o-mini",
        keyPrefix: "sk-or-",
        headerFormat: "bearer",
        requestFormat: "openai",
        extraHeaders: {
            "HTTP-Referer": "chrome-extension://cover-letter-generator",
            "X-Title": "Cover Letter Generator"
        }
    },
    groq: {
        name: "Groq",
        baseUrl: "https://api.groq.com/openai/v1/chat/completions",
        defaultModel: "llama-3.1-70b-versatile",
        keyPrefix: "gsk_",
        headerFormat: "bearer",
        requestFormat: "openai"
    },
    anthropic: {
        name: "Anthropic (Claude)",
        baseUrl: "https://api.anthropic.com/v1/messages",
        defaultModel: "claude-3-haiku-20240307",
        keyPrefix: "sk-ant-",
        headerFormat: "x-api-key",
        requestFormat: "anthropic"
    },
    gemini: {
        name: "Google Gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        defaultModel: "gemini-1.5-flash",
        keyPrefix: "AI",
        headerFormat: "query",
        requestFormat: "gemini"
    },
    deepseek: {
        name: "DeepSeek",
        baseUrl: "https://api.deepseek.com/chat/completions",
        defaultModel: "deepseek-chat",
        keyPrefix: "sk-",
        headerFormat: "bearer",
        requestFormat: "openai"
    },
    together: {
        name: "Together.ai",
        baseUrl: "https://api.together.xyz/v1/chat/completions",
        defaultModel: "meta-llama/Llama-3-70b-chat-hf",
        keyPrefix: "",
        headerFormat: "bearer",
        requestFormat: "openai"
    }
};

/**
 * Make API call to any supported provider
 * @param {string} provider - Provider ID (openai, anthropic, etc.)
 * @param {string} apiKey - API key for the provider
 * @param {Array} messages - Array of message objects [{role, content}]
 * @param {number} temperature - Temperature for generation (0-1)
 * @param {string} model - Optional model override
 * @returns {Promise<string>} - Generated text response
 */
async function callAPI(provider, apiKey, messages, temperature = 0.5, model = null) {
    const config = API_PROVIDERS[provider];
    if (!config) {
        throw new Error(`Unknown provider: ${provider}`);
    }

    const selectedModel = model || config.defaultModel;
    let url = config.baseUrl;
    let headers = { "Content-Type": "application/json" };
    let body;

    // Build headers based on provider
    if (config.headerFormat === "bearer") {
        headers["Authorization"] = `Bearer ${apiKey}`;
    } else if (config.headerFormat === "x-api-key") {
        headers["x-api-key"] = apiKey;
        headers["anthropic-version"] = "2023-06-01";
    } else if (config.headerFormat === "query") {
        url = url.replace("{model}", selectedModel) + `?key=${apiKey}`;
    }

    // Add extra headers if specified
    if (config.extraHeaders) {
        Object.assign(headers, config.extraHeaders);
    }

    // Build request body based on format
    if (config.requestFormat === "openai") {
        body = JSON.stringify({
            model: selectedModel,
            messages: messages,
            temperature: temperature
        });
    } else if (config.requestFormat === "anthropic") {
        // Convert OpenAI message format to Anthropic format
        const systemMsg = messages.find(m => m.role === "system");
        const userMessages = messages.filter(m => m.role !== "system");

        body = JSON.stringify({
            model: selectedModel,
            max_tokens: 2048,
            system: systemMsg ? systemMsg.content : undefined,
            messages: userMessages.map(m => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.content
            }))
        });
    } else if (config.requestFormat === "gemini") {
        // Convert to Gemini format
        const contents = messages.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
        }));

        body = JSON.stringify({
            contents: contents,
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: 2048
            }
        });
    }

    // Make the request
    const response = await fetch(url, {
        method: "POST",
        headers: headers,
        body: body
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${config.name} API error (${response.status}): ${errorText}`);
    }

    const json = await response.json();

    // Extract response text based on format
    if (config.requestFormat === "openai") {
        return json.choices?.[0]?.message?.content || "";
    } else if (config.requestFormat === "anthropic") {
        return json.content?.[0]?.text || "";
    } else if (config.requestFormat === "gemini") {
        return json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }

    throw new Error("Unknown response format");
}

/**
 * Automatically detect API provider from API key format
 * @param {string} apiKey - The API key to analyze
 * @returns {string} - Detected provider ID (defaults to 'openai')
 */
function detectProviderFromKey(apiKey) {
    if (!apiKey || apiKey.length < 5) return 'openai';

    // Check specific prefixes in order of specificity
    if (apiKey.startsWith('sk-ant-')) return 'anthropic';
    if (apiKey.startsWith('sk-or-')) return 'openrouter';
    if (apiKey.startsWith('gsk_')) return 'groq';
    if (apiKey.startsWith('xai-')) return 'xai'; // X.AI/Grok
    if (apiKey.startsWith('AIzaSy')) return 'gemini'; // Google AI keys
    if (apiKey.match(/^[A-Za-z0-9]{39}$/)) return 'gemini'; // Gemini API keys are 39 chars

    // DeepSeek and OpenAI both use sk- prefix
    // Default to OpenAI for sk- keys (most common)
    if (apiKey.startsWith('sk-')) return 'openai';

    // Together.ai keys are typically long alphanumeric
    if (apiKey.length > 40 && !apiKey.includes('-')) return 'together';

    // Default to OpenAI-compatible format
    return 'openai';
}

/**
 * Smart API call with automatic provider detection
 * @param {string} apiKey - API key (provider auto-detected)
 * @param {Array} messages - Array of message objects [{role, content}]
 * @param {number} temperature - Temperature for generation (0-1)
 * @param {string} model - Optional model override
 * @returns {Promise<string>} - Generated text response
 */
async function callAPIWithAutoDetect(apiKey, messages, temperature = 0.5, model = null) {
    const provider = detectProviderFromKey(apiKey);
    return await callAPI(provider, apiKey, messages, temperature, model);
}

/**
 * Validate API key format for a provider
 * @param {string} provider - Provider ID
 * @param {string} apiKey - API key to validate
 * @returns {boolean} - Whether key format is valid
 */
function validateApiKeyFormat(provider, apiKey) {
    const config = API_PROVIDERS[provider];
    if (!config) return false;

    // Empty prefix means no validation
    if (!config.keyPrefix) return apiKey.length > 10;

    return apiKey.startsWith(config.keyPrefix);
}

/**
 * Get list of available providers
 * @returns {Array} - Array of {id, name} objects
 */
function getAvailableProviders() {
    return Object.entries(API_PROVIDERS).map(([id, config]) => ({
        id: id,
        name: config.name,
        defaultModel: config.defaultModel
    }));
}

/**
 * Get provider configuration
 * @param {string} provider - Provider ID
 * @returns {Object} - Provider configuration
 */
function getProviderConfig(provider) {
    return API_PROVIDERS[provider] || null;
}

/**
 * Get human-readable provider name from API key
 * @param {string} apiKey - The API key
 * @returns {string} - Provider name
 */
function getProviderNameFromKey(apiKey) {
    const provider = detectProviderFromKey(apiKey);
    const config = API_PROVIDERS[provider];
    return config ? config.name : 'Unknown';
}
