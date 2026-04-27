<script lang="ts">
  import { browser } from "$app/environment";

  export interface FilterOption {
    value: string | number;
    label: string;
  }

  export interface FilterSection {
    id: string;
    label: string;
    sublabel?: string;
    options: FilterOption[];
    active: Set<string | number>;
    onToggle: (value: string | number) => void;
  }

  interface Props {
    sections: FilterSection[];
    hasActive?: boolean;
    onReset?: () => void;
    /** Trigger element — panel positions itself just below this element. */
    anchor: HTMLElement | null;
  }

  let { sections, hasActive = false, onReset, anchor }: Props = $props();

  let top = $state(0);
  let right = $state(0);

  $effect(() => {
    if (!browser || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    top = rect.bottom + 4;
    right = window.innerWidth - rect.right;
  });
</script>

<!--
  Panel renders position:fixed so it floats above overflow:hidden ancestors.
  Clicks inside are stopped from bubbling so the toolbar's outside-click handler
  does not close the panel prematurely.
-->
<div
  class="tfp"
  style="top: {top}px; right: {right}px;"
  role="dialog"
  tabindex="-1"
  aria-label="Filters"
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  {#each sections as section (section.id)}
    <div class="tfp-section">
      <div class="tfp-label">
        {section.label}{#if section.sublabel}<span class="tfp-sublabel"
            >{section.sublabel}</span
          >{/if}
      </div>
      <div class="tfp-chips">
        {#each section.options as opt (opt.value)}
          <button
            class="tfp-chip"
            class:tfp-chip-on={section.active.has(opt.value)}
            onclick={() => section.onToggle(opt.value)}>{opt.label}</button
          >
        {/each}
      </div>
    </div>
  {/each}
  {#if hasActive && onReset}
    <button class="tfp-reset" onclick={onReset}>CLEAR FILTERS</button>
  {/if}
</div>

<style>
  .tfp {
    position: fixed;
    z-index: 1000;
    min-width: 13rem;
    background: #0e1012;
    border: 1px solid var(--tv-border);
    padding: 0.5rem 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  }

  .tfp-section {
    display: flex;
    flex-direction: column;
    gap: 0.18rem;
  }

  .tfp-label {
    font-size: 0.55rem;
    letter-spacing: 0.1em;
    color: rgba(176, 38, 255, 0.55);
    margin-bottom: 0.1rem;
  }

  .tfp-sublabel {
    font-size: 0.5rem;
    letter-spacing: 0.04em;
    color: rgba(176, 38, 255, 0.35);
    font-weight: 400;
    margin-left: 0.3em;
  }

  .tfp-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem;
  }

  .tfp-chip {
    padding: 0.06rem 0.35rem;
    font-family: inherit;
    font-size: 0.6rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    background: transparent;
    border: 1px solid var(--tv-border);
    color: var(--tv-text-muted);
    cursor: pointer;
    transition:
      color 0.1s,
      border-color 0.1s,
      background 0.1s;
  }

  .tfp-chip:hover {
    border-color: rgba(176, 38, 255, 0.4);
    color: var(--tv-text-primary);
  }

  .tfp-chip-on {
    background: rgba(176, 38, 255, 0.15);
    border-color: rgba(176, 38, 255, 0.5);
    color: var(--tv-highlight-soft);
  }

  .tfp-reset {
    margin-top: 0.1rem;
    padding: 0.1rem 0.4rem;
    font-family: inherit;
    font-size: 0.58rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    background: transparent;
    border: 1px solid rgba(255, 77, 87, 0.35);
    color: rgba(255, 77, 87, 0.7);
    cursor: pointer;
    width: 100%;
    transition:
      color 0.1s,
      border-color 0.1s;
  }

  .tfp-reset:hover {
    color: #ff4d57;
    border-color: #ff4d57;
  }
</style>
