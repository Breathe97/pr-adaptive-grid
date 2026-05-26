<template>
  <div id="app" style="position: relative; width: 100vw; height: 100vh">
    <PrAdaptiveGrid :list="list"> </PrAdaptiveGrid>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { PrAdaptiveGrid } from '../../src/index.ts'
import type { ListItem } from '../../src/index.ts'

const list = ref<ListItem[]>([
  { id: '1', width: 200, height: 300 },
  { id: '2', width: 200, height: 300 }
])
</script>
<style scoped></style>
