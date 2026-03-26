import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: "0.0.0.0",
    port: parseInt(process.env.YACT_WEB_PORT ?? "5175"),
    strictPort: true,
    allowedHosts: ["ubuntuserver"],
  },
});
