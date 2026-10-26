import { ToolDefinition } from '../../types';

export const passwordStrengthMetadata: Omit<ToolDefinition, 'component'> = {
  id: 'password-strength',
  slug: 'password-strength',
  name: 'Password Strength Analyzer',
  shortDescription: 'Audit password entropy, character diversity, and vulnerability to dictionary and sequential patterns with guaranteed zero-upload privacy.',
  description: 'Evaluate password complexity, bit entropy, and vulnerability to brute-force attacks client-side. Tests against common password dumps, repetitive sequences, and keyboard patterns with zero data transmitted.',
  category: 'security',
  badge: '100% Private',
  featured: false,
  iconName: 'Lock',
  keywords: ['password strength', 'password analyzer', 'entropy calculator', 'password checker', 'password complexity', 'secure password'],
  relatedTools: ['hash-generator', 'jwt-decoder', 'uuid-generator'],
  seo: {
    title: 'Password Strength Analyzer — Private Entropy & Pattern Checker',
    description: 'Analyze password strength, bit entropy, and pattern vulnerabilities directly in your browser. Strictly 100% client-side with zero data storage or network calls.',
    canonicalPath: '/password-strength'
  },
  educationalContent: {
    title: 'Understanding Password Entropy & Modern Authentication',
    subtitle: 'A technical reference on information entropy, password cracking math, and why length beats complexity.',
    content: [
      {
        heading: 'What is Password Entropy?',
        body: 'Password entropy measures the unpredictability of a password in bits. A password with 70 bits of entropy requires approximately 2^70 guesses to crack via brute force. Long multi-word passphrases (e.g. 4 random dictionary words) naturally achieve high entropy while remaining easy to remember.'
      },
      {
        heading: 'Why Length Beats Complex Rules',
        body: 'Arbitrary character substitution rules (like replacing "E" with "3") add minimal entropy because modern cracking algorithms (like Hashcat and John the Ripper) specifically test these leetspeak rules. Increasing length exponentially expands the search space.'
      },
      {
        heading: 'The Importance of Password Managers',
        body: 'Reusing even an extremely strong password across multiple websites poses severe danger: if any single service suffers a breach, attackers will attempt credential stuffing across all your other accounts. Use a password manager to generate unique passwords for every site.'
      }
    ],
    faqs: [
      {
        question: 'Could my password be intercepted while using this tool?',
        answer: 'No. All evaluation logic runs in your browser’s local JavaScript sandbox. No network requests are made, no cookies are written, and passwords are never passed to analytics or logs.'
      },
      {
        question: 'Why doesn’t this tool show exact cracking time in years?',
        answer: 'Cracking speed depends entirely on the attacker’s hardware (e.g. cluster of modern GPUs) and whether the target system uses fast unsalted hashes (like MD5) or modern memory-hard key derivation (like Argon2id or bcrypt). Claims like "takes 1 million years" are misleading without context.'
      }
    ]
  }
};
