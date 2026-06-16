import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

export default defineConfig({
  site: "https://temidayoxyz.github.io",
  base: "/opencheckout/",
  integrations: [
    starlight({
      title: "OpenCheckout",
      description: "Open-source, self-hosted checkout powered by Open Payments.",
      social: {
        github: "https://github.com/temidayoxyz/opencheckout",
      },
      sidebar: [
        {
          label: "Start Here",
          items: [
            { label: "Introduction", slug: "index" },
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
      editLink: {
        baseUrl: "https://github.com/temidayoxyz/opencheckout/edit/main/docs/",
      },
    }),
  ],
});
