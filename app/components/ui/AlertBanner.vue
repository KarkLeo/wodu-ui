<template>
  <div class="alert-banner" role="alert">
    <p class="alert-banner-text"><slot /></p>
    <slot name="action" />
  </div>
</template>

<style scoped>
.alert-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--vtt-danger);
  border-radius: var(--r-sm);
  background: var(--vtt-danger-soft);
}
.alert-banner-text { margin: 0; font-family: var(--font-serif); font-size: 13px; color: var(--vtt-danger-bright); }
</style>
