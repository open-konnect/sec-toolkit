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
    title: "Cron Expression Generator",
    description: "Build and understand cron expressions in your browser. Get a plain-English explanation and upcoming run times for standard five-field schedules.",
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
      },
      {
        heading: 'Common cron examples',
        body: 'Read a schedule left to right: minute, hour, day of month, month, day of week. These examples are safe starting points; adapt the command and time zone to your platform.',
        codeExample: '*/5 * * * *      every 5 minutes\n0 * * * *        every hour at minute 0\n0 2 * * *        daily at 02:00\n30 9 * * 1-5     weekdays at 09:30\n0 0 1 * *        first day of every month\n0 0 * * 0        every Sunday at midnight'
      },
      {
        heading: 'Day-of-month and day-of-week semantics',
        body: 'In traditional cron, when both day-of-month and day-of-week are restricted (neither is *), the job runs when either field matches, not only when both match. This OR behavior surprises many users. If you need a specific date that is also a specific weekday, express the date in day-of-month and keep day-of-week as *, or enforce the condition inside the job itself.'
      },
      {
        heading: 'Dialect differences are not cosmetic',
        body: 'Linux/Unix crontab, GitHub Actions, and Kubernetes CronJob use five fields. Quartz uses six or seven fields with seconds first and supports ? for "no specific value." Spring’s scheduler commonly uses six fields with seconds. AWS EventBridge uses six fields with a year field and does not support all POSIX operators. Copying an expression between platforms without checking the dialect can shift every run time.'
      },
      {
        heading: 'Time zones and missed runs',
        body: 'Cron evaluates against the daemon’s configured time zone, which is often UTC on servers. If a job seems to run at the wrong local hour, check the time zone before changing the expression. Cron does not catch up on runs missed while the scheduler was down; use a persistent job queue when every execution must be processed.'
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
      },
      {
        question: 'What does */5 * * * * mean?',
        answer: 'It runs every five minutes: the minute field uses a step of 5, and every other field matches all values. The first execution is at minute 0, then 5, 10, and so on.'
      },
      {
        question: 'Why does my cron job run at the wrong time?',
        answer: 'The scheduler’s time zone is usually different from your local time zone. Check whether the daemon uses UTC or a configured zone, and convert the intended local time before editing the expression.'
      }
    ]
  }
};
