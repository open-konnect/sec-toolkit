import { ToolDefinition } from '../../types';

export const llmTokenCalculatorMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'llm-token-calculator',
  slug: 'llm-token-calculator',
  name: 'LLM Token & Cost Calculator',
  shortDescription: 'Estimate token counts and API costs across popular language models (GPT-4o, Claude 3.5, Gemini 1.5) with editable pricing rates.',
  description: 'Fast, provider-neutral LLM token and cost estimator. Calculate prompt tokens, expected completion costs, and context-window consumption locally with zero data sent to external AI providers.',
  category: 'ai',
  badge: 'Provider Neutral',
  featured: false,
  iconName: 'Cpu',
  keywords: ['llm token calculator', 'token counter', 'openai pricing', 'claude pricing', 'gemini pricing', 'token estimator', 'cost calculator', 'llm cost'],
  relatedTools: ['json-formatter', 'regex-tester', 'json-to-typescript'],
  seo: {
    title: "LLM Token & Cost Calculator",
    description: "Estimate token counts and API costs for popular language models in your browser. Adjust pricing and output size without sending prompts to a provider.",
    canonicalPath: '/llm-token-calculator'
  },
  educationalContent: {
    title: 'Understanding LLM Tokenization, BPE & API Pricing',
    subtitle: 'A technical reference on Byte-Pair Encoding (BPE), token-to-character ratios, and cost management in AI applications.',
    content: [
      {
        heading: 'What is a Token in Large Language Models?',
        body: 'Large Language Models do not read text character-by-character or word-by-word; they process chunks of text known as tokens. Using Byte-Pair Encoding (BPE), common words like "the" or "security" are single tokens, while rare words, code syntax, or foreign languages may split into multiple sub-word tokens.'
      },
      {
        heading: 'Token-to-Word and Token-to-Character Ratios',
        body: 'As a general rule of thumb in standard English prose, 1 token is roughly equivalent to 4 characters or 0.75 words. In code or non-English languages, the token density increases significantly.'
      },
      {
        heading: 'Why Token Estimation Matters',
        body: 'API pricing is billed per million tokens (input and output separately). Estimating prompt size prevents unexpected bill shocks, helps architects design efficient context windows, and informs chunking strategies for Retrieval-Augmented Generation (RAG).'
      },
      {
        heading: 'Input tokens, output tokens, and context windows',
        body: 'Input tokens are the prompt, system instructions, retrieved documents, and conversation history sent to the model. Output tokens are the generated completion. Both count toward the model’s context window, so a large prompt leaves less room for the answer. Leave headroom for the completion and for any tool-call metadata; providers may truncate or reject requests that exceed the limit.'
      },
      {
        heading: 'Why the estimate is approximate',
        body: 'This calculator uses a local character-and-word heuristic, not the provider’s tokenizer. Code, JSON, punctuation, emoji, and non-English scripts often tokenize differently than English prose. Treat the result as a planning estimate, and use the usage object returned by the API when you need exact billing numbers.'
      },
      {
        heading: 'Pricing is configurable, not permanent',
        body: 'List prices change, and providers offer cached-input, batch, and enterprise rates that differ from the defaults. The input and output rates are editable so you can match your current contract. Output tokens usually cost more than input tokens, so a small change in the requested completion length can have a larger effect than trimming a few prompt words.'
      }
    ],
    faqs: [
      {
        question: 'Are my prompts uploaded to any LLM provider when using this calculator?',
        answer: 'No. All token estimates and price computations are performed strictly in your browser using local BPE heuristics. No text is sent to OpenAI, Anthropic, or any third-party API.'
      },
      {
        question: 'Can I update the pricing if an AI provider drops their rates?',
        answer: 'Yes! The $/1M token input and output rates are completely editable in the interface so you can adjust them to reflect current prices, custom enterprise tiers, or batch discounts.'
      },
      {
        question: 'Why do token counts differ between models?',
        answer: 'Each provider uses a different tokenizer and vocabulary. The same sentence, especially code or non-English text, can produce different token counts across GPT, Claude, and Gemini models.'
      },
      {
        question: 'Is the cost estimate exact?',
        answer: 'No. It is a planning estimate based on approximate token counts and the rates you enter. Use the provider’s usage response and current pricing for invoices or budget commitments.'
      }
    ]
  }
};
