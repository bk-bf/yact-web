<script lang="ts">
  import { browser } from "$app/environment";
  import type { Snippet } from "svelte";

  interface Props {
    /** If provided (non-null), render MINER/API source toggle */
    source?: "miner" | "api" | null;
    onSourceChange?: (s: "miner" | "api") => void;
    /** If provided, render a ↻ reconnect button */
    onReconnect?: () => void;
    /** If provided, render ⇅ flip button; pass current reversed state */
    reversed?: boolean;
    onFlip?: () => void;
    /** If >= 0, render ≡ filter button with badge */
    activeFilterCount?: number;
    /** Filter dropdown content, rendered inside the filter-wrap when open */
    filterDropdown?: Snippet;
    /** If provided, render ↵ wrap toggle button */
    wrapped?: boolean;
    onWrap?: () => void;
  }

  let {
    source,
    onSourceChange,
    onReconnect,
    reversed = false,
    onFlip,
    activeFilterCount,
    filterDropdown,
    wrapped = false,
    onWrap,
  }: Props = $props();

  let filterOpen = $state(false);
  let filterWrapEl = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!filterOpen || !browser) return;
    function onOutside(e: MouseEvent) {
      if (filterWrapEl && !filterWrapEl.contains(e.target as Node)) {
        filterOpen = false;
      }
    }
    document.addEventListener("click", onOutside, true);
    return () => document.removeEventListener("click", onOutside, true);
  });
</script>

<div class="stt">
  {#if source != null && onSourceChange}
    <button
      class="stt-tab"
      class:stt-act={source === "miner"}
      onclick={() => onSourceChange!("miner")}>MINER</button
    >
    <button
      class="stt-tab"
      class:stt-act={source === "api"}
      onclick={() => onSourceChange!("api")}>API</button
    >
  {/if}
  {#if onReconnect}
    <button class="stt-btn" onclick={onReconnect} title="Reconnect">↻</button>
  {/if}
  {#if onFlip}
    <button
      class="stt-btn"
      class:stt-act={reversed}
      onclick={onFlip}
      title={reversed
        ? "Newest at top — click to flip"
        : "Newest at bottom — click to flip"}>⇅</button
    >
  {/if}
  {#if onWrap}
    <button
      class="stt-btn"
      class:stt-act={wrapped}
      onclick={onWrap}
      title={wrapped ? "Unwrap long lines" : "Wrap long lines"}>↵</button
    >
  {/if}
  {#if activeFilterCount !== undefined}
    <div class="stt-filter-wrap" bind:this={filterWrapEl}>
      <button
        class="stt-btn"
        class:stt-act={activeFilterCount > 0}
        onclick={(e) => {
          e.stopPropagation();
          filterOpen = !filterOpen;
        }}
        title="Filters"
        >≡{#if activeFilterCount > 0}<span class="stt-badge"
            >{activeFilterCount}</span
          >{/if}</button
      >
      {#if filterOpen && filterDropdown}
        {@render filterDropdown()}
      {/if}
    </div>
  {/if}
</div>

<style>
  .stt {
    display: flex;
    align-items: center;
    gap: 0.2rem;
    flex-shrink: 0;
  }

  /* Unified height for both tab-style and icon-style buttons */
  .stt-tab,
  .stt-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 0.9rem;
    padding: 0 0.32rem;
    font-family: inherit;
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    line-height: 1;
    border: 1px solid rgba(176, 38, 255, 0.2);
    background: transparent;
    color: rgba(200, 212, 207, 0.45);
    cursor: pointer;
    white-space: nowrap;
    transition:
      color 0.12s,
      border-color 0.12s;
  }

  .stt-tab:hover,
  .stt-btn:hover {
    color: rgba(200, 212, 207, 0.8);
    border-color: rgba(176, 38, 255, 0.45);
  }

  .stt-act {
    color: var(--tv-highlight, #b026ff) !important;
    border-color: rgba(176, 38, 255, 0.6) !important;
  }

  .stt-filter-wrap {
    position: relative;
  }

  .stt-badge {
    display: inline-block;
    margin-left: 0.18em;
    font-size: 0.5rem;
    color: var(--tv-highlight, #b026ff);
    vertical-align: super;
    line-height: 1;
  }
</style>
