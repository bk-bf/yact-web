<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import M3Surface from "../../lib/components/M3Surface.svelte";
  import LoadingDots from "../../lib/components/LoadingDots.svelte";

  type ProviderStatus = "healthy" | "rate_limited" | "error";

  interface ProviderHealth {
    provider: string;
    status: ProviderStatus;
    error_streak: number;
    last_success_at: string | null;
  }

  let providers = $state<ProviderHealth[]>([]);
  let loading = $state(true);
  let lastUpdated = $state<Date | null>(null);
  let intervalId: ReturnType<typeof setInterval> | null = null;

  function formatRelativeTime(isoString: string | null): string {
    if (!isoString) return "never";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "never";
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  }

  function statusColor(status: ProviderStatus): string {
    switch (status) {
      case "healthy":
        return "var(--status-ok)";
      case "rate_limited":
        return "var(--status-warn)";
      case "error":
        return "var(--status-error)";
      default:
        return "var(--tv-text-muted)";
    }
  }

  function statusLabel(status: ProviderStatus): string {
    switch (status) {
      case "healthy":
        return "Healthy";
      case "rate_limited":
        return "Rate limited";
      case "error":
        return "Error";
      default:
        return status;
    }
  }

  async function fetchHealth() {
    try {
      const res = await fetch("/api/provider-health");
      const data = await res.json();
      providers = Array.isArray(data) ? data : [];
    } catch {
      providers = [];
    } finally {
      loading = false;
      lastUpdated = new Date();
    }
  }

  onMount(() => {
    if (!browser) return;
    fetchHealth();
    intervalId = setInterval(fetchHealth, 30_000);
    return () => {
      if (intervalId !== null) clearInterval(intervalId);
    };
  });

  function formatLastUpdated(date: Date): string {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
</script>

<main class="status-page">
  <div class="status-header">
    <h1 class="status-title">Provider Health</h1>
    <div class="status-meta">
      {#if lastUpdated}
        <span class="last-updated"
          >Last updated: {formatLastUpdated(lastUpdated)}</span
        >
      {/if}
      <button class="m3-button outlined" onclick={fetchHealth}>Refresh</button>
    </div>
  </div>

  <M3Surface title="Provider Status">
    {#if loading}
      <LoadingDots />
    {:else if providers.length === 0}
      <p class="empty-state">
        No provider data yet — waiting for first miner cycle
      </p>
    {:else}
      <ul class="provider-list">
        {#each providers as p (p.provider)}
          <li class="provider-row">
            <span
              class="status-badge"
              style="background: {statusColor(p.status)};"
              aria-label={statusLabel(p.status)}
            ></span>
            <span class="provider-name">{p.provider}</span>
            <span class="status-label" style="color: {statusColor(p.status)};"
              >{statusLabel(p.status)}</span
            >
            <span class="streak-count">
              {p.error_streak > 0 ? `${p.error_streak} errors` : "—"}
            </span>
            <span class="last-success">
              {formatRelativeTime(p.last_success_at)}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </M3Surface>
</main>

<style>
  .status-page {
    max-width: 860px;
    margin: 2rem auto;
    padding: 0 1.5rem;
  }

  .status-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .status-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--tv-text-primary);
    margin: 0;
  }

  .status-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .last-updated {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
  }

  .empty-state {
    padding: 2.5rem 1rem;
    text-align: center;
    color: var(--tv-text-muted);
    font-size: 0.9375rem;
  }

  .provider-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .provider-row {
    display: grid;
    grid-template-columns: 1.25rem 1fr auto auto auto;
    align-items: center;
    gap: 0.75rem 1rem;
    padding: 0.75rem 0.25rem;
    border-bottom: 1px solid var(--color-row-divider);
  }

  .provider-row:last-child {
    border-bottom: none;
  }

  .status-badge {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .provider-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--tv-text-primary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .status-label {
    font-size: 0.8125rem;
    font-weight: 500;
    text-transform: capitalize;
    white-space: nowrap;
  }

  .streak-count {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
    white-space: nowrap;
    text-align: right;
  }

  .last-success {
    font-size: 0.8125rem;
    color: var(--tv-text-muted);
    white-space: nowrap;
    text-align: right;
    min-width: 6rem;
  }
</style>
