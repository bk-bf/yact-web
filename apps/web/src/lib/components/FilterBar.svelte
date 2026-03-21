<script lang="ts">
    interface FilterItem {
        label: string;
        active?: boolean;
    }

    interface Props {
        items: FilterItem[];
        role?: string;
        ariaLabel?: string;
        onselect?: (label: string, index: number) => void;
    }

    let { items, role = "toolbar", ariaLabel, onselect }: Props = $props();
</script>

<div class="table-filter-bar" {role} aria-label={ariaLabel}>
    <div class="table-filter-left">
        {#each items as item, i}
            <button
                type="button"
                class="table-filter-item"
                class:active={item.active}
                onclick={() => onselect?.(item.label, i)}
            >
                {item.label}
            </button>
        {/each}
    </div>
</div>
