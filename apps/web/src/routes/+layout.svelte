<script lang="ts">
  import "../app.css";
  import AppShellLayout from "../lib/layouts/AppShellLayout.svelte";
  import { page } from "$app/stores";

  let { children } = $props();

  // Full-screen routes bypass the app shell (no market bar, no nav header).
  const isFullscreen = $derived($page.url.pathname.startsWith("/terminal"));
</script>

{#if isFullscreen}
  {@render children?.()}
{:else}
  <AppShellLayout>
    {@render children?.()}
  </AppShellLayout>
{/if}
