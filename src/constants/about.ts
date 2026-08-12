import { INSTAGRAM_URL, GITHUB_URL } from "../config";
import hcmutLogo from "../assets/about/hcmut-logo.png";

export const aboutHero = {
  kicker: "Portfolio",
  title: "I'm MercenarioZ btw",
  description:
    "Software-leaning maker, blog keeper, and interface minimalist. I care about pages that load quickly, typography that behaves, and software that feels like it was tuned by someone who actually uses it.",
  mode: "Learning architecture. Building productivity utilities.",
};

export const aboutLinks = {
  github: GITHUB_URL,
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
  "Frontend developer trying to make niche stuff",
  "Backend services built to be boring, observable, and easy to recover",
  "Learning infrastructure by shipping small systems end to end",
];

export const aboutEducation = [
  {
    period: "Oct 2020 - Apr 2025",
    title: "Electronics and Telecommunications Engineering",
    place: "Ho Chi Minh City University of Technologies",
    body: "Studied communication systems, embedded electronics, and software engineering fundamentals.",
    image: hcmutLogo,
    imageAlt: "HCMUT official logo",
  },
];

export const aboutWorkExperience = [
  {
    period: "Sep 2025 - Present",
    title: "Cigro",
    place: "Ho Chi Minh City",
    body: "Full-stack developer focused on frontend work in React and Vue, with Spring Boot services on the backend.",
  },
  {
    period: "May 2023 - Nov 2023",
    title: "VNPT",
    place: "Ho Chi Minh City",
    body: "Built an ASP.NET web application for monitoring network devices such as switches and routers.",
  },
];
