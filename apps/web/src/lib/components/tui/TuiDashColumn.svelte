<script lang="ts">
  import type { Snippet } from "svelte";
  import LoadingDots from "../LoadingDots.svelte";

  interface Props {
    loading: boolean;
    /** Right column: remove border-right */
    noBorder?: boolean;
    /** Center column: overflow hidden (log stream manages its own scroll) */
    noScroll?: boolean;
    children: Snippet;
  }

  let {
    loading,
    noBorder = false,
    noScroll = false,
    children,
  }: Props = $props();
</script>

<div class="t-col" class:no-border={noBorder} class:no-scroll={noScroll}>
  {#if loading}
    <div class="col-loading">
      <LoadingDots label="Loading" />
    </div>
  {:else}
    {@render children()}
  {/if}
</div>

<style>
  .t-col {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
    overflow-x: hidden;
    border-right: 1px solid var(--tui-col-border, rgba(176, 38, 255, 0.12));
    scrollbar-width: thin;
    scrollbar-color: var(--tui-panel-grow-scrollbar, rgba(176, 38, 255, 0.15))
      transparent;
  }

  .no-border {
    border-right: none;
  }

  .no-scroll {
    overflow: hidden;
  }

  .col-loading {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  @media (max-width: 1100px) {
    .t-col {
      border-right: none;
      border-bottom: 1px solid rgba(176, 38, 255, 0.15);
    }

    .t-col:last-child {
      border-bottom: none;
    }
  }
</style>
