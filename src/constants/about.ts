import { INSTAGRAM_URL } from "../config";

export const aboutHero = {
  kicker: "Portfolio transmission",
  title: "Le Ba Nguyen Vu (MercenarioZ) builds quiet things for loud little obsessions.",
  description:
    "Software-leaning maker, blog keeper, and interface minimalist. I care about pages that load quickly, typography that behaves, and software that feels like it was tuned by someone who actually uses it.",
  mode: "Learning architecture. Building productivity utilities.",
};

export const aboutLinks = {
  github: "https://github.com/mercenarioZ",
  instagram: INSTAGRAM_URL,
};

export const aboutPrinciples = [
  {
    title: "Small surfaces, sharp edges",
    body: "I like interfaces that feel edited: fewer states, clearer affordances, and copy that does not explain what the UI already proves.",
  },
  {
    title: "Local-first attention",
    body: "My comfort zone is the narrow lane between CLI fluency, web craft, and tiny rituals that make daily tools feel personal.",
  },
  {
    title: "Taste with receipts",
    body: "Aesthetic choices should survive implementation: spacing, contrast, motion, and responsive behavior all need to hold up in the browser.",
  },
];

export const aboutCapabilityRows = [
  {
    label: "Language / UI",
    items: [
      { label: "TypeScript", icon: "typescript" },
      { label: "Java", icon: "java" },
      { label: "Kotlin", icon: "kotlin" },
      { label: "React", icon: "react" },
      { label: "Jetpack Compose", icon: "android" },
      { label: "Astro", icon: "astro" },
      { label: "Tailwind CSS", icon: "tailwind" },
    ],
  },
  {
    label: "Backend / Tooling",
    items: [
      { label: "Node.js", icon: "node" },
      { label: "Spring Boot", icon: "springboot" },
      { label: "Terminal", icon: "terminal" },
    ],
  },
  {
    label: "Infrastructure / Data",
    items: [
      { label: "AWS EC2", icon: "ec2" },
      { label: "Linux", icon: "linux" },
      { label: "Docker", icon: "docker" },
      { label: "PostgreSQL", icon: "postgresql" },
      { label: "MongoDB", icon: "mongodb" },
    ],
  },
] as const;

export const aboutFragments = [
  "Terminal workflows with too many aliases",
  "Backend services built to be boring, observable, and easy to recover",
  "Learning infrastructure by shipping small systems end to end",
  "AWS EC2 experiments, Linux servers, deployment scripts, and logs",
];

export const aboutEducation = [
  {
    period: "Oct 2020 - Apr 2025",
    title: "Electronics and Telecommunications Engineering",
    place: "Ho Chi Minh City University of Technologies",
    body: "Placeholder for major, coursework, academic projects, and architecture fundamentals.",
    image: "/images/HCMUT_official_logo.png",
    imageAlt: "HCMUT official logo",
  },
];

export const aboutWorkExperience = [
  {
    period: "Sep 2025 - Present",
    title: "Cigro",
    place: "Ho Chi Minh City",
    body: "Placeholder for a tool that improves daily workflow, captures repeated tasks, or connects UI to backend behavior.",
  },
  {
    period: "May 2023 - Nov 2023",
    title: "Company 2",
    place: "Ho Chi Minh City",
    body: "Placeholder for API design, persistence, authentication, logging, and deployment details.",
  },
  {
    period: "Placeholder",
    title: "Android Companion App",
    place: "Personal project",
    body: "Placeholder for Kotlin, Jetpack Compose, offline state, and mobile-first utility flows.",
  },
];

export const aboutSideProjects = [
  {
    title: "Astro Blog & Portfolio",
    status: "Live",
    href: "/posts/astro-blog",
    body: "Personal writing space built around fast static pages, plain content files, and a design system that stays small enough to maintain.",
    stack: ["Astro", "TypeScript", "Tailwind CSS"],
  },
  {
    title: "Routine Tracker",
    status: "In progress",
    body: "A small mobile-first utility app that tracks routines and reminders, and helps you stay on track.",
    stack: ["Kotlin", "Jetpack Compose", "Spring Boot"],
  }
];
