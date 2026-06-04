<template>
  <div class="pr-adaptive-grid-item" :style="[ItemStyle]">
    <div class="pr-adaptive-grid-item-inner" :style="[ItemInnerStyle]">
      <slot :item="Info" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { PropType } from 'vue'
import type { Geo } from '../../types'

const props = defineProps({
  id: {
    required: true,
    type: String
  },
  geo: {
    required: true,
    type: Object as PropType<Geo>
  }
})

const Info = computed(() => {
  const { id, geo } = props
  const info = { id, ...geo, sticky: true, fixed: true }
  return info
})

const ItemStyle = computed(() => {
  const { top, left } = props.geo

  const x = `${left}px`
  const y = `${top}px`
  return {
    transform: `translate3d(${x},${y},0)`
  }
})

const ItemInnerStyle = computed(() => {
  const { width, height } = props.geo
  return {
    width: `${width}px`,
    height: `${height}px`
  }
})
</script>

<style scoped>
.pr-adaptive-grid-item {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 2;
  box-sizing: border-box;
  will-change: transform;
}

.pr-adaptive-grid-item-leaving {
  z-index: 1;
}
.pr-adaptive-grid-item-inner {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transform-origin: center center;
  cursor: grab;
  touch-action: none;
}
.pr-adaptive-grid-item-layout-anim {
  transition: transform var(--ag-duration-position, 700ms) var(--ag-ease-position);
}
.pr-adaptive-grid-item-layout-anim .pr-adaptive-grid-item-inner {
  transition:
    width var(--ag-duration-size) var(--ag-ease-size),
    height var(--ag-duration-size) var(--ag-ease-size);
}
@keyframes ag-inner-enter {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes ag-inner-leave {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.3);
  }
}
.pr-adaptive-grid-item-inner.ag-inner-enter {
  animation: ag-inner-enter var(--ag-duration-enter) var(--ag-ease-fade) 100ms both;
}
.pr-adaptive-grid-item-inner.ag-inner-leave {
  animation: ag-inner-leave var(--ag-duration-exit) var(--ag-ease-fade) both;
  pointer-events: none;
}

.pr-adaptive-grid-item-pinned {
  z-index: 20;
}

.pr-adaptive-grid-item-dragging {
  z-index: 25; /* 高于 pinned 的 20 */
  cursor: grabbing;
}
</style>
