<script lang="ts">
  interface Props {
    open: boolean;
    hlAddress: string | null;
    solAddress: string | null;
    onclose: () => void;
    onSetHl: (addr: string | null) => void;
    onSetSol: (addr: string | null) => void;
  }

  let { open, hlAddress, solAddress, onclose, onSetHl, onSetSol }: Props =
    $props();

  let hlInput = $state("");
  let solInput = $state("");

  // Sync inputs when addresses change from outside
  $effect(() => {
    hlInput = hlAddress ?? "";
  });
  $effect(() => {
    solInput = solAddress ?? "";
  });

  function applyHl() {
    const v = hlInput.trim();
    if (!v) return;
    onSetHl(v);
    onclose();
  }

  function applySol() {
    const v = solInput.trim();
    if (!v) return;
    onSetSol(v);
    onclose();
  }

  function disconnectHl() {
    onSetHl(null);
    hlInput = "";
  }

  function disconnectSol() {
    onSetSol(null);
    solInput = "";
  }

  function handleOverlayKey(e: KeyboardEvent) {
    if (e.key === "Escape") onclose();
  }

  function handleBackdropClick() {
    onclose();
  }

  function stopPropagation(e: MouseEvent) {
    e.stopPropagation();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="overlay"
    role="dialog"
    aria-modal="true"
    aria-label="Settings"
    tabindex="-1"
    onkeydown={handleOverlayKey}
    onclick={handleBackdropClick}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div class="panel" onclick={stopPropagation} onkeydown={(e) => e.stopPropagation()}>
      <div class="panel-header">
        <span class="panel-title">⚙ SETTINGS</span>
        <button class="close-btn" onclick={onclose} title="Close [Esc]"
          >✕</button
        >
      </div>

      <div class="panel-section">
        <div class="section-label">
          <span class="icon">⬡</span> HYPERLIQUID WALLET
        </div>
        {#if hlAddress}
          <div class="connected-row">
            <span class="addr-display">{hlAddress}</span>
            <button class="disc-btn" onclick={disconnectHl}>DISCONNECT</button>
          </div>
        {:else}
          <div class="input-row">
            <input
              class="addr-input"
              bind:value={hlInput}
              placeholder="0x… EVM address (public, read-only)"
              onkeydown={(e) => e.key === "Enter" && applyHl()}
              spellcheck={false}
              autocomplete="off"
            />
            <button
              class="connect-btn"
              onclick={applyHl}
              disabled={!hlInput.trim()}>SAVE</button
            >
          </div>
          <div class="hint">
            Public wallet address — no private key required
          </div>
        {/if}
      </div>

      <div class="section-divider"></div>

      <div class="panel-section">
        <div class="section-label">
          <span class="icon">◎</span> SOLANA / JUPITER WALLET
        </div>
        <div class="hint-note">
          A Solana wallet address and public key are the same value.
        </div>
        {#if solAddress}
          <div class="connected-row">
            <span class="addr-display">{solAddress}</span>
            <button class="disc-btn" onclick={disconnectSol}>DISCONNECT</button>
          </div>
        {:else}
          <div class="input-row">
            <input
              class="addr-input"
              bind:value={solInput}
              placeholder="Solana wallet address (base58)"
              onkeydown={(e) => e.key === "Enter" && applySol()}
              spellcheck={false}
              autocomplete="off"
            />
            <button
              class="connect-btn"
              onclick={applySol}
              disabled={!solInput.trim()}>SAVE</button
            >
          </div>
          <div class="hint">
            Public wallet address — no private key required
          </div>
        {/if}
      </div>

      <div class="panel-footer">
        <span class="footer-hint">[Esc] close</span>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0, 0, 0, 0.72);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .panel {
    background: #0a0014;
    border: 1px solid rgba(176, 38, 255, 0.45);
    box-shadow:
      0 0 40px rgba(176, 38, 255, 0.18),
      0 0 80px rgba(0, 0, 0, 0.6);
    width: min(520px, 94vw);
    font-family: "JetBrains Mono", "Menlo", "Consolas", monospace;
    font-size: 0.7rem;
    color: #c8d4cf;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem 0.4rem;
    border-bottom: 1px solid rgba(176, 38, 255, 0.22);
    background: rgba(176, 38, 255, 0.06);
  }

  .panel-title {
    color: rgba(176, 38, 255, 0.9);
    font-size: 0.64rem;
    letter-spacing: 0.1em;
  }

  .close-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(200, 212, 207, 0.45);
    font-size: 0.75rem;
    line-height: 1;
    padding: 0 0.1rem;
  }
  .close-btn:hover {
    color: #ff4d57;
  }

  .panel-section {
    padding: 0.7rem 0.75rem 0.6rem;
  }

  .section-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    color: rgba(176, 38, 255, 0.7);
    font-size: 0.6rem;
    letter-spacing: 0.09em;
    margin-bottom: 0.45rem;
  }

  .icon {
    color: rgba(176, 38, 255, 0.55);
  }

  .hint-note {
    color: rgba(200, 212, 207, 0.38);
    font-size: 0.58rem;
    margin-bottom: 0.4rem;
  }

  .input-row {
    display: flex;
    gap: 0.4rem;
  }

  .addr-input {
    flex: 1;
    min-width: 0;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(176, 38, 255, 0.22);
    color: #c8d4cf;
    font-family: "JetBrains Mono", monospace;
    font-size: 0.64rem;
    padding: 0.25rem 0.5rem;
    outline: none;
  }
  .addr-input:focus {
    border-color: rgba(176, 38, 255, 0.55);
  }
  .addr-input::placeholder {
    color: rgba(200, 212, 207, 0.22);
  }

  .connect-btn {
    background: rgba(176, 38, 255, 0.14);
    border: 1px solid rgba(176, 38, 255, 0.35);
    color: rgba(176, 38, 255, 0.9);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.6rem;
    letter-spacing: 0.07em;
    padding: 0.25rem 0.6rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .connect-btn:hover:not(:disabled) {
    background: rgba(176, 38, 255, 0.26);
    color: #b026ff;
  }
  .connect-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .hint {
    color: rgba(200, 212, 207, 0.3);
    font-size: 0.57rem;
    margin-top: 0.3rem;
  }

  .connected-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background: rgba(29, 223, 114, 0.04);
    border: 1px solid rgba(29, 223, 114, 0.15);
    padding: 0.28rem 0.5rem;
  }

  .addr-display {
    flex: 1;
    min-width: 0;
    color: rgba(200, 212, 207, 0.55);
    font-size: 0.6rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }

  .disc-btn {
    background: none;
    border: 1px solid rgba(255, 77, 87, 0.3);
    color: rgba(255, 77, 87, 0.65);
    font-family: "JetBrains Mono", monospace;
    font-size: 0.58rem;
    letter-spacing: 0.06em;
    padding: 0.18rem 0.45rem;
    cursor: pointer;
    white-space: nowrap;
  }
  .disc-btn:hover {
    background: rgba(255, 77, 87, 0.1);
    color: #ff4d57;
  }

  .section-divider {
    height: 1px;
    background: rgba(176, 38, 255, 0.1);
    margin: 0 0.75rem;
  }

  .panel-footer {
    padding: 0.3rem 0.75rem;
    border-top: 1px solid rgba(176, 38, 255, 0.1);
    text-align: right;
  }

  .footer-hint {
    color: rgba(200, 212, 207, 0.25);
    font-size: 0.58rem;
  }
</style>
