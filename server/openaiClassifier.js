import crypto from 'node:crypto';
import { config, hasOpenAiConfig } from './config.js';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const classificationCache = new Map();

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'is_conflict_event',
    'should_create_alert',
    'type',
    'severity',
    'confidence',
    'locations',
  ],
  properties: {
    is_conflict_event: { type: 'boolean' },
    should_create_alert: { type: 'boolean' },
    type: {
      type: 'string',
      enum: ['update', 'warning', 'airstrike', 'carAttack', 'artillery', 'missile', 'explosion', 'drone', 'warplane'],
    },
    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    locations: {
      type: 'array',
      maxItems: 5,
      items: { type: 'string' },
    },
  },
};

function normalizeCacheKey(text, sourceChannel) {
  return crypto
    .createHash('sha256')
    .update(`${String(sourceChannel || '').toLowerCase()}|${String(text || '').trim().toLowerCase()}`)
    .digest('hex');
}

function getCached(key) {
  const entry = classificationCache.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    classificationCache.delete(key);
    return null;
  }

  return entry.value;
}

function setCached(key, value) {
  classificationCache.set(key, {
    cachedAt: Date.now(),
    value,
  });
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload?.output)) {
    return '';
  }

  for (const item of payload.output) {
    if (!Array.isArray(item?.content)) {
      continue;
    }

    for (const content of item.content) {
      if (typeof content?.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return '';
}

function sanitizeClassification(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const locations = Array.isArray(value.locations)
    ? value.locations
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 5)
    : [];

  return {
    isConflictEvent: Boolean(value.is_conflict_event),
    shouldCreateAlert: Boolean(value.should_create_alert),
    type: typeof value.type === 'string' ? value.type : 'update',
    severity: typeof value.severity === 'string' ? value.severity : 'low',
    confidence: Number.isFinite(value.confidence) ? Number(value.confidence) : 0,
    locations,
  };
}

export async function classifyTelegramMessage(text, sourceChannel) {
  if (!hasOpenAiConfig()) {
    return null;
  }

  const cacheKey = normalizeCacheKey(text, sourceChannel);
  const cached = getCached(cacheKey);
  if (cached) {
    return cached;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.openAiBaseUrl}/responses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.openAiApiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.openAiModel,
        instructions:
          'Classify Telegram posts from Lebanon conflict channels. Only mark should_create_alert true for actionable attack or warning events affecting Lebanon. Prefer airstrike for raid or strike language from aircraft or drones. Ignore commentary, politics, repost chatter, aftermath-only updates without a new strike, and vague military analysis. Ignore channel footer/promotional lines such as WhatsApp channel invites. If a post contains Arabic followed by an English translation of the same content, use the Arabic content only and do not duplicate locations. Return only real Lebanese place names, never generic terrain or direction words such as river, riverbed, road, axis, border, valley, vicinity, or neighborhood unless they are part of a known proper place name. If a message mentions mixed event types, choose the dominant actionable type only; do not broaden locations from one clause into another.',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Source channel: ${sourceChannel || 'unknown'}\nMessage:\n${text}`,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'telegram_alert_classification',
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenAI classification failed with ${response.status}: ${body.slice(0, 200)}`);
    }

    const payload = await response.json();
    const rawText = extractResponseText(payload);
    const parsed = sanitizeClassification(JSON.parse(rawText));
    setCached(cacheKey, parsed);
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}
