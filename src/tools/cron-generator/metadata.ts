import { ToolDefinition } from '../../types';

export const cronGeneratorMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'cron-generator',
  slug: 'cron-generator',
  name: 'Cron Expression Generator',
  shortDescription: 'Construct standard 5-part cron schedules visually with human-readable explanations and upcoming execution time calculations.',
  description: 'Generate, parse, and understand standard POSIX cron schedules. Build schedules for minutes, hours, weekdays, and months with next execution calculations and zero server tracking.',
  category: 'developer',
  badge: 'POSIX 5-Part',
  featured: false,
  iconName: 'Calendar',
  keywords: ['cron', 'cron generator', 'cron expression', 'crontab', 'schedule generator', 'cron parser', 'scheduled tasks'],
  relatedTools: ['timestamp-converter', 'uuid-generator', 'regex-tester'],
  seo: {
    title: 'Cron Expression Generator — Build & Explain Crontab Schedules',
    description: 'Construct and understand 5-part cron expressions visually in your browser. Get plain-English explanations and next execution times instantly.',
    canonicalPath: '/cron-generator'
  },
  educationalContent: {
    title: 'Understanding Cron Syntax, Dialects & Scheduling',
    subtitle: 'A technical reference on POSIX crontab fields, special characters, and differences between cron dialects.',
    content: [
      {
        heading: 'Standard 5-Field POSIX Cron Syntax',
        body: 'Standard Unix crontab contains exactly 5 fields separated by spaces:\n1. Minute (0–59)\n2. Hour (0–23)\n3. Day of Month (1–31)\n4. Month (1–12)\n5. Day of Week (0–7, where both 0 and 7 represent Sunday).'
      },
      {
        heading: 'Cron Dialects (5-Field vs 6-Field)',
        body: 'Standard Linux/Unix cron, GitHub Actions, and Kubernetes use 5 fields. Systems like Quartz Scheduler and AWS EventBridge use 6 or 7 fields (including seconds at the beginning or year at the end, and the "?" character). Ensure you verify your platform’s supported dialect.'
      },
      {
        heading: 'Special Characters',
        body: '• * (Asterisk): Matches all possible values for that field.\n• , (Comma): Separates distinct items (e.g. 1,15,30).\n• - (Hyphen): Defines an inclusive range (e.g. 1-5 for Monday through Friday).\n• / (Slash): Specifies step intervals (e.g. */15 for every 15 minutes).'
      }
    ],
    faqs: [
      {
        question: 'Does this tool support timezone conversions for cron?',
        answer: 'Cron daemons typically evaluate expressions against the server’s system timezone or UTC. The execution estimates provided by this tool are calculated in UTC for universal consistency.'
      },
      {
        question: 'Are my generated cron expressions sent to a remote service?',
        answer: 'No. All parsing and scheduling projections run entirely in your local browser.'
      }
    ]
  }
};
