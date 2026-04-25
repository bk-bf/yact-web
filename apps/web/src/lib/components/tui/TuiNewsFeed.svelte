<script lang="ts">
  import TuiPanel from "./TuiPanel.svelte";
  import type { TuiHeadline } from "$lib/types/terminal";

  interface Props {
    newsRows: (TuiHeadline & { key: number })[];
  }

  let { newsRows }: Props = $props();

  const latestKey = $derived(newsRows.length > 0 ? newsRows[newsRows.length - 1].key : -1);
</script>

<TuiPanel label="NEWS FEED // CRYPTO" grow noPadding>
  {#if newsRows.length === 0}
    <span class="news-feed-empty">Streaming headlines…</span>
  {:else}
    {#each newsRows as row (row.key)}
      <div class="news-feed-row" class:news-feed-new={row.key === latestKey}>
        <a href={row.url} target="_blank" rel="noreferrer" class="news-feed-link">{row.title}</a>
        <span class="news-feed-src">{row.source}</span>
      </div>
    {/each}
  {/if}
</TuiPanel>

<style>
  .news-feed-row {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding: 0.3rem 0.5rem 0.28rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.07);
  }
  @keyframes news-in {
    from { opacity: 0; background: rgba(176, 38, 255, 0.07); }
    to   { opacity: 1; background: transparent; }
  }
  .news-feed-new { animation: news-in 0.5s ease-out forwards; }
  .news-feed-link {
    color: rgba(242, 232, 255, 0.76);
    text-decoration: none;
    font-size: 0.65rem;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .news-feed-link:hover { color: #e3a4ff; text-decoration: underline; }
  .news-feed-src {
    color: rgba(176, 38, 255, 0.52);
    font-size: 0.58rem;
    letter-spacing: 0.05em;
  }
  .news-feed-empty { color: rgba(200, 212, 207, 0.28); font-size: 0.65rem; padding: 0.35rem 0.5rem; }
</style>
