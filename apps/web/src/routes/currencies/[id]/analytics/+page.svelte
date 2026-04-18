<script lang="ts">
  import AnalyticsPageView from "../../../../lib/pages/analytics/AnalyticsPageView.svelte";
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.coinId} Analytics | YACT</title>
</svelte:head>

<AnalyticsPageView coinId={data.coinId} />
