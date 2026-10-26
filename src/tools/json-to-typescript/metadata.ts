import { ToolDefinition } from '../../types';

export const jsonToTypescriptMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'json-to-typescript',
  slug: 'json-to-typescript',
  name: 'JSON to TypeScript Converter',
  shortDescription: 'Infer and generate clean TypeScript interfaces and type definitions from JSON payloads with automatic nested object decomposition.',
  description: 'Convert JSON objects into strongly-typed TypeScript interfaces or type aliases directly in your browser. Recursively resolves nested structures, arrays, and primitive union types.',
  category: 'data',
  badge: 'Type Inference',
  featured: false,
  iconName: 'Code2',
  keywords: ['json to typescript', 'json to ts', 'typescript interfaces', 'type generator', 'json schema to ts', 'ts types from json'],
  relatedTools: ['json-formatter', 'jwt-decoder', 'llm-token-calculator'],
  seo: {
    title: "JSON to TypeScript Converter",
    description: "Convert JSON examples into TypeScript interfaces and types directly in your browser. Inspect nested objects and arrays without uploading your payload.",
    canonicalPath: '/json-to-typescript'
  },
  educationalContent: {
    title: 'TypeScript Type Inference & Interface Best Practices',
    subtitle: 'A technical reference on typing dynamic JSON, interfaces versus type aliases, and handling optional or nullable fields.',
    content: [
      {
        heading: 'Why Type Your JSON Payloads?',
        body: 'Dynamic APIs frequently return unexpected data structures. Generating compile-time TypeScript contracts prevents runtime null-pointer exceptions, enhances IDE auto-completion, and catches breaking API contract changes before deployment.'
      },
      {
        heading: 'Interfaces vs. Type Aliases in TypeScript',
        body: 'Interfaces are extendable via declaration merging and inheritance (extends), making them ideal for object-oriented architectures and API models. Type aliases are more flexible for unions, intersections, primitives, and mapped tuples.'
      },
      {
        heading: 'Nested objects and arrays',
        body: 'The generator walks the example recursively. Nested objects become separate exported declarations and are referenced by name from their parent. Arrays are inferred from their elements: a homogeneous array becomes string[], a mixed array becomes a union such as (string | number)[], and an empty array cannot reveal its element type, so it becomes unknown[].'
      },
      {
        heading: 'Optional and nullable fields',
        body: 'Inference only knows what appears in the example. If a field is missing from the sample, it is not marked optional; if a field is present with null, its type includes null. Optionality is a property of the API contract, not the example. Review generated interfaces and add ? or | null deliberately, especially for response fields that may be omitted.'
      },
      {
        heading: 'Limitations of inferring types from JSON',
        body: 'A single example cannot prove a schema. Different records may contain different fields or value types, numbers may represent integers, floats, or cents, and date strings remain string rather than Date. Generated names are derived from keys and can collide when the same key appears in unrelated branches. Treat the output as a first draft and validate it against real API documentation and runtime validation.',
        codeExample: '{\n  "user": {\n    "id": 42,\n    "email": "alice@example.com",\n    "tags": ["admin"],\n    "deletedAt": null\n  }\n}\n\n// Generated (review before use)\nexport interface User {\n  id: number;\n  email: string;\n  tags: string[];\n  deletedAt: null;\n}'
      }
    ],
    faqs: [
      {
        question: 'How does this tool handle mixed-type arrays in JSON?',
        answer: 'Arrays containing heterogeneous elements are converted into TypeScript union types, e.g. (string | number)[].'
      },
      {
        question: 'Does this tool transmit my JSON payload to any AI or server?',
        answer: 'No. Type inference is executed entirely client-side using deterministic TypeScript parsing algorithms inside your browser.'
      },
      {
        question: 'Are the generated TypeScript types exact?',
        answer: 'No. They describe the example payload you provided. Optional fields, nullable values, date strings, and mixed arrays need human review before the types are used as a contract.'
      },
      {
        question: 'How are optional fields handled?',
        answer: 'A field is only known to exist if it appears in the example. The generator does not mark fields optional automatically because absence in one sample does not prove the API omits them. Add ? to the properties that your API documentation says may be missing.'
      },
      {
        question: 'Will date strings become Date objects?',
        answer: 'No. JSON has no date type, so ISO 8601 values are inferred as string. If your application converts them to Date, update the generated type or use a runtime parser such as Zod.'
      }
    ]
  }
};
