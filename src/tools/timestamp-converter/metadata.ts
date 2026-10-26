import { ToolDefinition } from '../../types';

export const timestampConverterMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'timestamp-converter',
  slug: 'timestamp-converter',
  name: 'Unix Timestamp Converter',
  shortDescription: 'Convert between Unix epoch timestamps (seconds & milliseconds), ISO 8601 strings, UTC dates, and local times.',
  description: 'Fast, two-way epoch converter for developers. Parse timestamps in seconds or milliseconds, calculate relative elapsed durations, and convert ISO 8601 dates with zero server requests.',
  category: 'developer',
  badge: 'Popular',
  featured: true,
  iconName: 'Clock',
  keywords: ['timestamp', 'unix epoch', 'timestamp converter', 'epoch to date', 'iso 8601', 'seconds to date', 'utc converter'],
  relatedTools: ['uuid-generator', 'cron-generator', 'jwt-decoder'],
  seo: {
    title: "Unix Timestamp Converter",
    description: "Convert Unix timestamps to dates and dates to epoch seconds or milliseconds directly in your browser. Supports UTC, ISO 8601, and local time.",
    canonicalPath: '/timestamp-converter'
  },
  educationalContent: {
    title: 'Understanding Unix Epoch & Timestamp Standards',
    subtitle: 'A technical reference on POSIX time, second versus millisecond resolution, and the Year 2038 problem.',
    content: [
      {
        heading: 'What is Unix Epoch Time?',
        body: 'Unix time (POSIX time) measures the number of seconds that have elapsed since 00:00:00 UTC on January 1, 1970 (excluding leap seconds). It is the universal standard for timestamping events, database records, and authentication tokens across distributed systems.'
      },
      {
        heading: 'Seconds vs. Milliseconds',
        body: 'Systems written in C, Go, Python, and JWT claims typically use seconds (10 digits, e.g. 1774880000). JavaScript (Date.now()), Java, and high-frequency messaging systems use milliseconds (13 digits, e.g. 1774880000000). Passing milliseconds where seconds are expected causes dates far in the distant future.'
      },
      {
        heading: 'The Year 2038 Problem (Y2038)',
        body: 'On January 19, 2038 at 03:14:07 UTC, 32-bit signed integers will overflow. Modern 64-bit systems represent timestamps well past the lifetime of the universe, but legacy systems must be upgraded to 64-bit integers to prevent integer wrap-around.'
      },
      {
        heading: 'Reading epoch values: examples',
        body: 'A value of 0 is 1970-01-01T00:00:00Z. The value 1704067200 (10 digits) is 2024-01-01T00:00:00Z in seconds; 1704067200000 (13 digits) is the same instant in milliseconds. Negative values represent times before the epoch. When a date looks decades or thousands of years off, check whether the unit is seconds or milliseconds before changing the date.',
        codeExample: '1704067200      -> 2024-01-01T00:00:00Z (seconds)\n1704067200000   -> 2024-01-01T00:00:00Z (milliseconds)\n0               -> 1970-01-01T00:00:00Z\n-86400          -> 1969-12-31T00:00:00Z'
      },
      {
        heading: 'UTC, local time, and ISO 8601',
        body: 'An instant is the same everywhere; its display changes with the time zone. Store and transmit timestamps in UTC, then format them in the user’s local zone at the presentation layer. ISO 8601 strings such as 2024-01-01T00:00:00Z include an explicit UTC designator, while 2024-01-01T00:00:00+02:00 includes an offset. Prefer explicit offsets over ambiguous local strings.'
      }
    ],
    faqs: [
      {
        question: 'Does this tool communicate with any time server?',
        answer: 'No. The converter uses your browser engine’s native JavaScript Date object and hardware clock.'
      },
      {
        question: 'How does this tool distinguish between seconds and milliseconds?',
        answer: 'Timestamps with less than 11 digits (magnitude < 1e11) are automatically recognized as seconds, while larger 13-digit values are parsed as milliseconds.'
      },
      {
        question: 'Is 1704067200 seconds or milliseconds?',
        answer: 'It is seconds: 1704067200 corresponds to 2024-01-01T00:00:00Z. The millisecond version of the same instant is 1704067200000, which has three extra digits.'
      },
      {
        question: 'Should I store timestamps in UTC or local time?',
        answer: 'Store and transmit instants in UTC (or as an ISO 8601 string with an explicit offset). Convert to the user’s local time zone only when formatting for display.'
      }
    ]
  }
};
