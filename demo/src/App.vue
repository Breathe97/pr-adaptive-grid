<template>
  <div id="app" style="position: relative; width: 100vw; height: 100vh">
    <PrAdaptiveGrid :list="list">
      <template #default="{ item }">
        <div class="item">{{ item.id }}</div>
      </template>
    </PrAdaptiveGrid>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { PrAdaptiveGrid } from '../../src/index.ts'
import type { ListItem } from '../../src/index.ts'

const list = ref<ListItem[]>([
  { id: '1', w: 200, h: 300 },
  { id: '2', w: 200, h: 300 }
])
</script>
<style scoped>
.item {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: red;
}
</style>
