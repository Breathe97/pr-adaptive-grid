<template>
  <div ref="outerRef" class="pr-adaptive-grid-item" :style="[ItemStyle]">
    <div ref="innerRef" class="pr-adaptive-grid-item-inner" :style="[ItemInnerStyle]">
      <slot :item="Info" />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { PropType } from 'vue'
import type { Geo } from '../../types'

const AG_DURATION_POSITION = 7000
const AG_EASING_POSITION = 'cubic-bezier(0.22, 1, 0.44, 1)'
const AG_DURATION_SIZE = 7000
const AG_EASING_SIZE = 'cubic-bezier(0.22, 1, 0.44, 1)'

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

const outerRef = ref<HTMLElement>()
const innerRef = ref<HTMLElement>()

const Info = computed(() => {
  const { id, geo } = props
  const info = { id, ...geo, sticky: true, fixed: true }
  return info
})

const ItemStyle = computed(() => {
  const { cx, cy } = props.geo

  return {
    transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`
  }
})

const ItemInnerStyle = computed(() => {
  const { width, height } = props.geo
  return {
    width: `${width}px`,
    height: `${height}px`
  }
})

const toTransform = (newGeo: Geo) => {
  const outer = outerRef.value
  const inner = innerRef.value

  if (!outer || !inner) return

  // 获取当前几何信息
  const getCurrentCenterGeo = () => {
    const rect = outer.getBoundingClientRect()
    const parentRect = (outer.offsetParent as HTMLElement).getBoundingClientRect()
    return {
      cx: rect.left - parentRect.left + rect.width / 2,
      cy: rect.top - parentRect.top + rect.height / 2,
      width: parseFloat(getComputedStyle(inner).width),
      height: parseFloat(getComputedStyle(inner).height)
    }
  }

  const currentGeo = getCurrentCenterGeo() // 当前几何

  outer.getAnimations().forEach((a) => a.cancel()) // 取消动画
  inner.getAnimations().forEach((a) => a.cancel()) // 取消动画

  // 执行新动画
  outer.animate(
    [
      // 开始
      { transform: `translate3d(${currentGeo.cx}px, ${currentGeo.cy}px, 0) translate(-50%, -50%)` },
      // 结束
      { transform: `translate3d(${newGeo.cx}px, ${newGeo.cy}px, 0) translate(-50%, -50%)` }
    ],
    { duration: AG_DURATION_POSITION, easing: AG_EASING_POSITION }
  )

  // 执行新动画
  inner.animate(
    [
      // 开始
      { width: `${currentGeo.width}px`, height: `${currentGeo.height}px` },
      // 结束
      { width: `${newGeo.width}px`, height: `${newGeo.height}px` }
    ],
    { duration: AG_DURATION_SIZE, easing: AG_EASING_SIZE }
  )
}

watch(
  () => ({ ...props.geo }),
  (geo) => toTransform(geo),
  { flush: 'post' }
)
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
