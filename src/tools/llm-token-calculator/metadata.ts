import { ToolDefinition } from '../../types';

export const llmTokenCalculatorMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'llm-token-calculator',
  slug: 'llm-token-calculator',
  name: 'LLM Token & Cost Calculator',
  shortDescription:
    'Estimate tokens from an actual prompt and sample response, then calculate API costs with a regularly refreshed, build-time model pricing catalog.',
  description:
    'Paste the prompt you sent and a sample response you received to estimate input, output, and total tokens locally. Compare cached-input costs and daily or monthly API spend across thousands of language models without sending your text anywhere.',
  category: 'ai',
  badge: 'Catalog-backed',
  featured: false,
  iconName: 'Cpu',
  keywords: [
    'llm token calculator',
    'token counter',
    'llm cost calculator',
    'openai pricing',
    'claude pricing',
    'gemini pricing',
    'token estimator',
    'prompt token counter',
    'sample output tokens',
    'cached input pricing',
    'api cost per month'
  ],
  relatedTools: ['json-formatter', 'regex-tester', 'json-to-typescript'],
  seo: {
    title: 'LLM Token & Cost Calculator',
    description:
      'Estimate LLM tokens from a real prompt and sample response, then compare cached pricing and monthly API spend locally in your browser.',
    canonicalPath: '/llm-token-calculator'
  },
  educationalContent: {
    title: 'LLM Tokens, Pricing & API Cost Planning',
    subtitle:
      'How language model billing works, why the same prompt costs different amounts across models, and how to turn token counts into a realistic monthly estimate.',
    content: [
      {
        heading: 'What is a token in a language model?',
        body: 'Language models do not read text character-by-character. They split text into tokens, which are common words, word fragments, punctuation, or bytes. A short common word may be one token, while code, JSON, emoji, and non-English scripts often require several tokens per word. Token counts therefore depend on the tokenizer used by the model, not just on the number of characters.'
      },
      {
        heading: 'Estimating from your prompt and sample response',
        body: 'The calculator measures the actual prompt text you paste and the sample response you received, using the same local estimator for both. That makes the output side a measurement of real text rather than a prediction of how long a future answer might be. The estimator is a deterministic browser-side heuristic, not a model-specific tokenizer: it blends roughly 3.9 characters per token with 1.33 tokens per whitespace-delimited word. Real tokenizers can produce different counts, especially for code, JSON, URLs, emoji, and non-English scripts.'
      },
      {
        heading: 'Input tokens vs output tokens',
        body: 'Input tokens are everything sent to the model: system instructions, conversation history, retrieved documents, tool definitions, and the user prompt. Output tokens are the generated response, including reasoning or tool-call text where the provider bills it. The calculator estimates the visible prompt and sample response separately, so you can use either field on its own. In a real request, both usually count toward the context window but are priced separately. Output is commonly several times more expensive per token than input, so the response length often dominates the bill.'
      },
      {
        heading: 'How LLM cost is calculated',
        body: 'For a model with separate input and output prices, the cost of one request is: (input tokens ÷ 1,000,000 × input price per million) + (output tokens ÷ 1,000,000 × output price per million). Daily and monthly figures multiply that per-request cost by the number of requests. The catalog stores per-token prices, so the calculator converts them to the familiar price per million tokens when it displays them.'
      },
      {
        heading: 'Why model prices differ so much',
        body: 'Providers price models according to capability, latency, context length, and infrastructure cost. A frontier model can cost many times more per token than a small or open-weight model. Hosted versions of the same open model may also differ between providers. Comparing the same token counts across a few candidates is usually more useful than assuming the largest model is the right default.'
      },
      {
        heading: 'Cached input and prompt caching',
        body: 'Some providers charge less for input tokens that reuse a previously cached prefix, such as a long system prompt or reference document. A cache read is typically billed at a fraction of the normal input rate, while writing the cache may carry its own rate. The calculator accepts a cached-token count only for models that publish cached-input pricing and treats cached tokens as part of the total input, not as extra tokens.'
      },
      {
        heading: 'Why pricing changes and how updates work',
        body: 'Model list prices, context limits, and cache rates change frequently. This site refreshes its catalog from the public LiteLLM model cost map during the build, then serves the resulting JSON from this domain. The “Updated on” date comes from that successful build-time fetch, not from the day you open the page. If a refresh fails, the build keeps the previous valid dataset and its original date rather than silently showing stale prices as current.'
      },
      {
        heading: 'Estimates versus your actual invoice',
        body: 'The calculator is a planning tool, not a billing system. Provider bills may account for things beyond the visible prompt and response, including system messages, conversation history, cached tokens, reasoning tokens, tool calls, multimodal inputs, batch or priority tiers, long-context surcharges, cache writes, minimum charges, negotiated discounts, and taxes. Token counts from this page are local approximations, so always reconcile budgets against the usage object and invoice from the provider.'
      },
      {
        heading: 'Keeping prompts private',
        body: 'Prompts and responses can contain source code, customer records, credentials, or internal documentation. This calculator runs entirely in the browser. It loads the model catalog from a static file on this site and performs token estimation and arithmetic locally. No prompt text, response text, token count, selected model, or calculated cost is sent to LiteLLM, OpenAI, Anthropic, Google, or any other third party. Your text stays in your browser and is never logged or included in analytics.'
      }
    ],
    faqs: [
      {
        question: 'Are my prompts or token counts sent to an AI provider?',
        answer:
          'No. The model list is a static JSON file served by this site, and every calculation happens in your browser. Prompt text, response text, token counts, selected models, and cost figures are never uploaded to LiteLLM or any model provider.'
      },
      {
        question: 'Does the calculator predict how many output tokens a future response will use?',
        answer:
          'No. Paste a sample response you actually received and the calculator estimates that text directly. It does not apply speculative heuristics such as “brief answer = 150 tokens” because real output length depends on the model, instructions, and task.'
      },
      {
        question: 'How current is the model pricing data?',
        answer:
          'The catalog is refreshed from the public LiteLLM model cost map during each build. The page shows an “Updated on” date taken from the last successful fetch. If that fetch fails, the build keeps the previous valid catalog and its original date instead of pretending the data is newer than it is.'
      },
      {
        question: 'Why can my provider invoice differ from this estimate?',
        answer:
          'The calculator multiplies your token counts by catalog list prices. Invoices can also include cache writes, batch or priority pricing, long-context rates, reasoning tokens, tool charges, minimums, discounts, and taxes. Use the provider’s usage report for exact billing.'
      },
      {
        question: 'Can I calculate costs for cached input tokens?',
        answer:
          'Yes, when the selected model publishes a cached-input rate. Enable the cached-input control and enter how many of the input tokens were cached. The calculator bills those tokens at the cached rate and the remainder at the normal input rate. Models without a published cache rate leave cached-input estimation disabled rather than guessing.'
      },
      {
        question: 'Why do token estimates differ between models?',
        answer:
          'Each model family uses a different tokenizer and vocabulary. The same sentence, especially code or non-English text, can produce different token counts for GPT, Claude, Gemini, Llama, and other models. The calculator estimates both the prompt and sample response with a local heuristic, so treat the counts as planning estimates rather than exact tokenizer output.'
      }
    ]
  }
};
