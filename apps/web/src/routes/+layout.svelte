<script lang="ts">
  import "../app.css";
  import { browser } from "$app/environment";
  import { onMount, setContext } from "svelte";
  import { page } from "$app/stores";
  import TuiTopbar from "$lib/components/tui/TuiTopbar.svelte";
  import TuiBottomBar from "$lib/components/tui/TuiBottomBar.svelte";
  import type { TuiGlobalData } from "$lib/types/terminal";
  import tuiFonts from "$lib/tui-fonts.json";
  import {
    createViewSettings,
    VIEW_SETTINGS_KEY,
  } from "$lib/composables/useViewSettings.svelte";
  import {
    createWatchlistIds,
    WATCHLIST_IDS_CONTEXT_KEY,
  } from "$lib/composables/useWatchlistIds.svelte";

  let { children } = $props();

  const viewSettings = createViewSettings();
  setContext(VIEW_SETTINGS_KEY, viewSettings);
  const watchlistIds = createWatchlistIds();
  setContext(WATCHLIST_IDS_CONTEXT_KEY, watchlistIds);

  let clockTime = $state("--:--:--");
  let blinkOn = $state(true);
  let globalData = $state<TuiGlobalData | null>(null);
  let coinCount = $state(0);
  let liveLoading = $state(true);

  function getActivePage(path: string): "markets" | "dashboard" | "terminal" {
    if (path.startsWith("/dashboard")) return "dashboard";
    if (path.startsWith("/terminal")) return "terminal";
    return "markets";
  }

  const activePage = $derived(getActivePage($page.url.pathname));

  onMount(() => {
    if (!browser) return;

    const pad2 = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const now = new Date();
      clockTime = `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}:${pad2(now.getUTCSeconds())}`;
      blinkOn = !blinkOn;
    };
    tick();
    const clockId = setInterval(tick, 1000);

    const fetchData = async () => {
      try {
        const res = await fetch("/api/topcoins?limit=50");
        if (res.ok) {
          const data = (await res.json()) as {
            global?: TuiGlobalData;
            coins?: unknown[];
          };
          if (data.global) globalData = data.global;
          const activeCount = (
            data.global as unknown as Record<string, unknown>
          )?.activeCryptocurrencies;
          coinCount =
            typeof activeCount === "number" && activeCount > 0
              ? activeCount
              : (data.coins?.length ?? 0);
        }
      } catch {
        /* keep last known state */
      } finally {
        liveLoading = false;
      }
    };
    void fetchData();
    const dataId = setInterval(fetchData, 60_000);

    return () => {
      clearInterval(clockId);
      clearInterval(dataId);
    };
  });
</script>

<svelte:head>
  <link rel="preconnect" href={tuiFonts.googleFontsPreconnect} />
  <link
    rel="preconnect"
    href={tuiFonts.googleFontsPreconnectCross}
    crossorigin="anonymous"
  />
  <link href={tuiFonts.googleFontsHref} rel="stylesheet" />
</svelte:head>

<div
  class="app-root"
  style="font-family: {tuiFonts.fontFamily}; font-size: {tuiFonts.fontSize}; line-height: {tuiFonts.lineHeight}"
>
  <TuiTopbar
    {globalData}
    {coinCount}
    {clockTime}
    {blinkOn}
    loading={liveLoading}
    {activePage}
  />
  <div class="app-content">
    {@render children?.()}
  </div>
  <TuiBottomBar branch="yact" meta="YACT" />
</div>

<style>
  .app-root {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    overflow: hidden;
  }

  .app-content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
