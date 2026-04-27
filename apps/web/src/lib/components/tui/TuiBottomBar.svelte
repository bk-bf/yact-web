<script lang="ts">
  interface Props {
    branch: string;
    meta: string;
  }

  let { branch, meta }: Props = $props();
</script>

<div class="t-botbar">
  <span class="t-key">[j/k]</span><span class="t-keylabel">scroll</span>
  <span class="t-key">[Tab]</span><span class="t-keylabel">panel</span>
  <span class="t-key">[r]</span><span class="t-keylabel">refresh</span>
  <span class="t-key">[f]</span><span class="t-keylabel">filter</span>
  <span class="t-key">[?]</span><span class="t-keylabel">help</span>
  <span class="t-key">[q]</span><span class="t-keylabel">quit</span>
  <span class="t-sep-r">│</span>
  <span class="t-branch">{branch}</span>
  <span class="t-sep-r">│</span>
  <span class="muted">{meta}</span>
</div>

<style>
  .t-botbar {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0 0.75rem;
    height: 1.6rem;
    background: #1e0938;
    border-top: 1px solid rgba(160, 60, 240, 0.4);
    box-shadow: 0 -2px 12px rgba(120, 20, 200, 0.15);
    flex-shrink: 0;
    white-space: nowrap;
    overflow: hidden;
  }
  .t-key {
    color: #b026ff;
    font-size: 0.62rem;
  }
  .t-keylabel {
    color: rgba(200, 212, 207, 0.42);
    font-size: 0.62rem;
    margin-right: 0.2rem;
  }
  .t-sep-r {
    color: rgba(176, 38, 255, 0.28);
    margin: 0 0.15rem;
  }
  .t-branch {
    color: rgba(176, 38, 255, 0.55);
    font-size: 0.62rem;
  }
  .muted {
    color: rgba(200, 212, 207, 0.35);
    font-size: 0.62rem;
  }
</style>
