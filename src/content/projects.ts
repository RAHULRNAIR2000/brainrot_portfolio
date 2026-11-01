// All copy lives here. Edit freely; the scene and UI read from this file only.
// Strings starting with "TODO" are placeholders Rahul still needs to replace (see STORIES.md).

export type Flavor = {
  id: string
  flavor: string // menu label
  project: string
  hook: string
  color: string // scoop colour
  accent: string // UI accent
  built: string
  broke: string
  learned: string
  next: string
  stack: string[]
  stats: { value: string; label: string }[] // big numbers on the story card
  media?: { type: 'image' | 'video'; src: string; alt: string }
  link?: { label: string; href: string }
}

export const vendorName = 'Mehmet Usta'

export const flavors: Flavor[] = [
  {
    id: 'rabble',
    flavor: 'Nordic Pistachio',
    project: 'Rabble · payments & cashback',
    hook: "Moving real money for people in four countries I've never been to.",
    color: '#9ccf5a',
    accent: '#b6e36f',
    built:
      'The backend for Rabble, a cashback app live across 4 Nordic countries. Two Spring Boot services (mobile and admin), integrations with four affiliate networks for clicks, callbacks and claims, RabbitMQ for push notifications and delayed jobs, and a 17-worker setup that includes a job syncing exchange rates for 16 currencies.',
    broke:
      'Money bugs. A redemption calculation that came out wrong. Reports that were off because of timezones. Endpoints scanning the entire Redis keyspace just to find one key. And a CI suite full of flaky tests that nobody trusted anymore.',
    learned:
      'In payments, "mostly right" is wrong. And the fastest query is the one you never make: I swapped full-collection loads for count queries and redesigned the cache keys so lookups go straight to the answer.',
    next:
      'Owned 23 Flyway migrations, plus backfill jobs that corrected historical transactions during a user-account migration. Added Testcontainers integration tests and cleared the flaky ones out of CI. Then started mentoring juniors so I was not the only person who knew where everything lived.',
    stack: ['Java', 'Spring Boot', 'PostgreSQL', 'Redis', 'RabbitMQ', 'Flyway', 'Testcontainers'],
    stats: [
      { value: '4', label: 'countries' },
      { value: '16', label: 'currencies synced' },
      { value: '23', label: 'schema migrations' },
      { value: '4', label: 'affiliate networks' },
    ],
  },
  {
    id: 'jule',
    flavor: 'Saffron Match',
    project: 'Jule · LLM skill matching',
    hook: "Teaching an LLM where it's not allowed to be trusted.",
    color: '#f2b233',
    accent: '#ffc94d',
    built:
      'Jule, a skill-matching platform that started as a fuzzy internal brief. A 56-module FastAPI backend: upload a job description or employee documents, an LLM behind a self-hosted LiteLLM gateway pulls out skills and roles, and the system builds learning plans. Plus Jule Engine, a Gemini-powered service that recommends what to learn next.',
    broke:
      'The model. Malformed JSON, skills nobody had ever listed, and days when the provider was simply down. Anything that depended on a single LLM call working was going to fail in front of someone.',
    learned:
      "Don't let the model have the last word. Deterministic skill-level matching sits on top of whatever the LLM extracts, so when the model is wrong the ranking gets a little worse instead of silently broken. Every LLM call gets a fallback path.",
    next:
      'Added a feedback endpoint so we learn which recommendations actually helped, and wrote about 6,000 words of docs so someone else could pick it up without me in the room. On the same idea I built a small RAG assistant that answers plain-English questions over our internal databases.',
    stack: ['Python', 'FastAPI', 'LiteLLM', 'Gemini', 'RAG', 'PostgreSQL', 'Docker'],
    stats: [
      { value: '56', label: 'FastAPI modules' },
      { value: '2', label: 'LLM products shipped' },
      { value: '6k', label: 'words of docs' },
    ],
  },
  {
    id: 'ai-team',
    flavor: 'Copilot Caramel',
    project: 'Bringing AI into how my team works',
    hook: 'Getting a whole backend team to actually use AI, safely.',
    color: '#c9783a',
    accent: '#e8955a',
    built:
      'Set up Claude Code across our backend repositories: the CLAUDE.md files, permission rules, and the conventions for migrations and workflows, so everyone gets the same careful assistant instead of five different ones.',
    broke:
      "Out of the box, the assistant didn't know our rules: how migrations are written, which commands are off limits, how our workflows fit together. Everyone had their own setup, so everyone got different results.",
    learned:
      'Adoption is less a tool problem than a trust problem. People use AI when the guardrails are written down and the first win comes quickly.',
    next: 'The rules now live in the repos next to the code, so a new engineer gets the same setup on day one, and changing a convention is a pull request like any other change.',
    stack: ['Claude Code', 'CLAUDE.md', 'Permission rules', 'Team conventions'],
    stats: [],
  },
  {
    id: 'ola',
    flavor: 'Rush Hour Ripple',
    project: 'Ola · competitor price watch',
    hook: 'Watching every ride price in the city so someone else could set theirs.',
    color: '#e04f6a',
    accent: '#ff6f8a',
    built:
      'A Java backend that collected ride-hailing and food-delivery prices from competitors across 1,000+ routes. Selenium did the collecting, Spring Boot thread pools ran it in parallel, and the results went into MySQL behind REST APIs for the business team.',
    broke:
      'The JVM, again and again. Lots of browser sessions running in parallel in one process, and my project folder is still full of hs_err_pid crash logs to prove it.',
    learned:
      'Scraping at scale is mostly failure handling: retries, timeouts, a thread pool sized to what the machine can actually take, and knowing when your data has gone stale.',
    next: 'It settled into daily batch runs from 6 am to 3 pm, with the pipeline tested in TestNG. I also led the juniors on it: assigning tasks, reviewing code, and keeping it clean and fast.',
    stack: ['Java', 'Spring Boot', 'Thread pools', 'Selenium', 'MySQL', 'TestNG'],
    stats: [
      { value: '1,000+', label: 'routes watched' },
      { value: '2', label: 'verticals: rides + food' },
    ],
  },
  {
    id: 'vahan',
    flavor: 'Rubber Stamp Blueberry',
    project: 'Vahan · automating government paperwork',
    hook: 'Teaching a bot to fill in government forms, state by state.',
    color: '#5b7fd6',
    accent: '#7d9bf0',
    built:
      "A Java automation framework for the Government of India's Vahan portal, where vehicle registrations live. Selenium worked the portal, Salesforce APIs supplied and received the data, and it generated and validated RC (registration certificate) records, with a small Swing desktop front end.",
    broke:
      'Every state does it a little differently. The same process has different steps, fields and quirks depending on where the vehicle is registered, so one script for the whole country was never going to work.',
    learned:
      "Automating a website you don't control means being defensive: wait for the page, check what actually happened, and make every step safe to run twice.",
    next: 'Tuned the backend processing and the Salesforce API calls until each transaction took 40% less time.',
    stack: ['Java', 'Selenium', 'Swing', 'Salesforce API', 'REST APIs'],
    stats: [{ value: '40%', label: 'faster per transaction' }],
  },
  {
    id: 'dmould',
    flavor: 'Kerala Coconut',
    project: "D'Mould Designs · a reel, just for fun",
    hook: "A side project: I edited an Instagram reel in code because I didn't want to learn Premiere.",
    color: '#f3efe4',
    accent: '#f7931e',
    built:
      'A vertical reel for D\'Mould Designs, a home-construction brand, rendered from React with Remotion. The song is 84 BPM with a drop at 0:60, and every cut is counted in beats from that drop. Zoom-blur into the drop, a white flash on the beat, a camera punch, Malayalam and English on screen.',
    broke:
      'Mostly my patience. Every cut was counted in beats from the drop, so moving one shot meant redoing the maths for everything after it.',
    learned:
      "A cut two frames late feels wrong even when nobody can say why. Also, React makes a perfectly fine video editor if you're stubborn enough.",
    next: "Nothing serious. It was just for fun, and I still haven't opened Premiere.",
    stack: ['Remotion', 'React', 'TypeScript', 'Beat-synced editing'],
    stats: [
      { value: '84', label: 'BPM' },
      { value: '19 s', label: 'reel' },
      { value: '0', label: 'times I opened Premiere' },
    ],
  },
]

export const finalScoop = {
  id: 'wispr',
  flavor: 'Wispr Flow',
  title: 'My first 30 days',
  color: '#b48cff',
  plan: [
    'Use Flow for everything and log every "wow" and every "ugh". Talk to 20 Indian users (devs, students, people who think in Hinglish or Malayalam-English) about where it clicks.',
    'Ship one growth experiment end to end myself. For example a "dictate your standup" loop for dev teams, because I have already driven AI-tool adoption inside one.',
    'Share what worked, what did not, and the numbers. Then double down on the one that moved.',
  ],
  contact: [
    { label: 'Email', href: 'mailto:rahulrnairsreemangalam@gmail.com', text: 'rahulrnairsreemangalam@gmail.com' },
    { label: 'LinkedIn', href: 'https://linkedin.com/in/rahulrnair01', text: 'in/rahulrnair01' },
    { label: 'GitHub', href: 'https://github.com/RAHULRNAIR2000', text: 'RAHULRNAIR2000' },
  ],
}

export const vendorLines = {
  greeting: 'Heyy kid! Come, come. Best ice cream in the world.',
  menu: 'Pick a flavor, kid. Any flavor.',
  offer: ['Here, take it!', 'For you, kid. Take!', 'Fresh, fresh! Come take.'],
  taunts: [
    'Almost, kid!',
    'Too slow!',
    'Ahh, hands like butter!',
    'Okay okay, one more.',
    'You are stubborn, I like this.',
    'This one is pistachio. Very fast flavor.',
    'Kid, you blink too much.',
    'My grandmother catches faster!',
  ],
  lucky: 'WHAT?! Nobody does this!',
  win: ['Ahh, good hands! Enjoy, kid.', 'Okay, you earned it!', 'Respect, kid. Respect.'],
  yieldLine: 'Hahaha okay, okay. You win. Take, take.',
  allTasted: 'Ahh, you tasted everything. Now, the secret flavor...',
  cat: 'Ahh, you found Pamuk! Free double scoop for you, kid.',
  idle: ['Kid? You still there?', 'Ice cream is melting, kid!'],
}
