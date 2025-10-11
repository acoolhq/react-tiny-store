// docs/.vitepress/config.ts
import { defineConfig } from "vitepress";

export default defineConfig({
  // If deploying to GitHub Pages at https://acoolhq.github.io/react-tiny-store/
  base: "/react-tiny-store/",
  title: "@acoolhq/react-tiny-store",
  description: "Tiny, selector-first state for React (uSES).",
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "Guides", link: "/guides/concepts" },
      { text: "API", link: "/api/" },
      { text: "Benchmark", link: "/benchmarks" },
    ],
    sidebar: [
      { text: "Introduction", link: "/" },
      { text: "Getting Started", link: "/getting-started" },
      {
        text: "Guides",
        items: [
          { text: "Concepts", link: "/guides/concepts" },
          { text: "SSR & Hydration", link: "/guides/ssr-hydration" },
          { text: "Performance Patterns", link: "/guides/perf-patterns" },
          { text: "Benchmarks", link: "/benchmarks" },
        ],
      },
      {
        text: "API Reference",
        link: "/api/",
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/acoolhq/react-tiny-store",
        ariaLabel: "Github",
      },
      {
        icon: "npm",
        link: "https://www.npmjs.com/package/@acoolhq/react-tiny-store",
        ariaLabel: "NPM",
      },
    ],
  },
});
