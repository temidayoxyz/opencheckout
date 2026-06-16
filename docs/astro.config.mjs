import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://temidayoxyz.github.io",
  base: "/opencheckout/",
  integrations: [
    starlight({
      title: "OpenCheckout",
      description: "Open-source, self-hosted checkout powered by Open Payments.",
      favicon: "/favicon.ico",
      logo: {
        light: "./src/assets/logo-light.png",
        dark: "./src/assets/logo-dark.png",
        alt: "OpenCheckout",
        replacesTitle: true,
      },
      head: [
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "https://temidayoxyz.github.io/opencheckout/og-image.png",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:width",
            content: "1200",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:height",
            content: "630",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:type",
            content: "website",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:card",
            content: "summary_large_image",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "https://temidayoxyz.github.io/opencheckout/og-image.png",
          },
        },
      ],
      social: {
        github: "https://github.com/temidayoxyz/opencheckout",
      },
      customCss: ["/src/custom.css"],
      sidebar: [
        {
          label: "Overview",
          items: [
            { label: "Introduction", slug: "introduction" },
            { label: "Getting Started", slug: "getting-started" },
            { label: "Dashboard Guide", slug: "dashboard-guide" },
          ],
        },
        {
          label: "Using OpenCheckout",
          items: [
            { label: "API Reference", slug: "api-reference" },
            { label: "Integration Guide", slug: "integration-guide" },
            { label: "Deployment", slug: "deployment" },
          ],
        },
        {
          label: "Under the Hood",
          items: [
            { label: "Architecture", slug: "architecture" },
            { label: "Security", slug: "security" },
          ],
        },
        {
          label: "Help",
          items: [
            { label: "FAQ", slug: "faq" },
          ],
        },
      ],
    }),
  ],
});
