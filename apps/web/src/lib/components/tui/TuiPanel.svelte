<script lang="ts">
  import type { Snippet } from "svelte";

  interface Props {
    label: string;
    grow?: boolean;
    fill?: boolean;
    noPadding?: boolean;
    children: Snippet;
  }

  let {
    label,
    grow = false,
    fill = false,
    noPadding = false,
    children,
  }: Props = $props();
</script>

<div class="t-panel" class:t-panel-grow={grow} class:t-panel-fill={fill}>
  <div class="t-plabel">{label}</div>
  <div class="t-pbody" class:no-padding={noPadding}>
    {@render children()}
  </div>
</div>

<style>
  .t-panel {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    border-bottom: 1px solid var(--tui-panel-sep, rgba(176, 38, 255, 0.08));
  }
  .t-panel-grow,
  .t-panel-fill {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
  .t-panel-grow .t-pbody {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--tui-panel-grow-scrollbar, rgba(176, 38, 255, 0.15))
      transparent;
  }
  .t-panel-fill .t-pbody {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .t-plabel {
    padding: 0.28rem 0.5rem 0.22rem;
    background: var(--tui-plabel-bg, rgba(176, 38, 255, 0.055));
    border-bottom: 1px solid var(--tui-plabel-border, rgba(176, 38, 255, 0.1));
    color: var(--tui-plabel-color, rgba(176, 38, 255, 0.72));
    font-size: 0.59rem;
    letter-spacing: 0.1em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }
  .t-pbody {
    padding: 0.35rem 0.5rem 0.3rem;
    overflow: visible;
  }
  .no-padding {
    padding: 0;
  }
</style>
