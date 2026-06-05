<template>
  <div ref="positionRef" class="pr-adaptive-grid-item-position" :style="[ItemStyle]">
    <div ref="sizeRef" class="pr-adaptive-grid-item-size" :style="[ItemInnerStyle]">
      <div ref="visualRef" class="pr-adaptive-grid-item-visual">
        <slot :item="Info" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, nextTick, onMounted } from 'vue'
import type { PropType } from 'vue'
import type { Geo } from '../../types'

const AG_DURATION_ENTER = 500
const AG_EASING_ENTER = 'ease-out'
const AG_DURATION_POSITION = 700
const AG_EASING_POSITION = 'cubic-bezier(0.22, 1, 0.44, 1)'
const AG_DURATION_SIZE = 700
const AG_EASING_SIZE = 'cubic-bezier(0.22, 1, 0.44, 1)'

const props = defineProps({
  id: {
    required: true,
    type: String
  },
  geo: {
    required: true,
    type: Object as PropType<Geo>
  },
  leaving: {
    required: false,
    type: Boolean,
    default: () => false
  },
  onLeaveEnd: {
    required: false,
    type: Function as PropType<(id: string) => void>,
    default: undefined
  }
})

let prevGeo: Geo = { ...props.geo }

const positionRef = ref<HTMLElement>()
const sizeRef = ref<HTMLElement>()
const visualRef = ref<HTMLElement>()

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

const saveStyles = (animate: Animation) => {
  if (animate.playState === 'idle') return
  animate.commitStyles()
  animate.cancel()
}

// 位移大小等变化
const toTransform = (newGeo: Geo) => {
  const outer = positionRef.value
  const inner = sizeRef.value
  if (!outer || !inner) return

  // 获取当前几何信息
  const getCurrentCenterGeo = () => {
    const rect = inner.getBoundingClientRect()
    // outer 是 absolute item，offsetParent 通常就是 .pr-adaptive-grid
    const parent = outer.offsetParent as HTMLElement | null
    if (!parent) return { ...newGeo }
    const parentRect = parent.getBoundingClientRect()
    const left = rect.left - parentRect.left + parent.scrollLeft
    const top = rect.top - parentRect.top + parent.scrollTop
    const width = rect.width
    const height = rect.height
    const cx = left + width / 2
    const cy = top + height / 2
    return { top, left, cx, cy, width, height }
  }

  const currentGeo = getCurrentCenterGeo() // 当前几何

  outer.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画
  inner.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画

  // 执行新动画
  outer
    .animate(
      [
        // 开始
        { transform: `translate3d(${currentGeo.cx}px, ${currentGeo.cy}px, 0) translate(-50%, -50%)` },
        // 结束
        { transform: `translate3d(${newGeo.cx}px, ${newGeo.cy}px, 0) translate(-50%, -50%)` }
      ],
      { duration: AG_DURATION_POSITION, easing: AG_EASING_POSITION }
    )
    .finished.then((animate) => saveStyles(animate))
    .catch(() => {})

  // 执行新动画
  inner
    .animate(
      [
        // 开始
        { width: `${currentGeo.width}px`, height: `${currentGeo.height}px` },
        // 结束
        { width: `${newGeo.width}px`, height: `${newGeo.height}px` }
      ],
      { duration: AG_DURATION_SIZE, easing: AG_EASING_SIZE }
    )
    .finished.then((animate) => saveStyles(animate))
    .catch(() => {})
}

watch(
  () => ({ ...props.geo }),
  (geo) => toTransform(geo)
)

// 退场动画
const leavTransform = () => {
  const visual = visualRef.value
  if (!visual) {
    props.onLeaveEnd?.(props.id)
    return
  }
  visual.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画
  const animation = visual.animate(
    [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.3)' }
    ],
    {
      duration: AG_DURATION_ENTER,
      easing: AG_EASING_ENTER,
      fill: 'forwards'
    }
  )
  animation.finished
    .then(() => {
      props.onLeaveEnd?.(props.id)
    })
    .catch(() => {
      props.onLeaveEnd?.(props.id)
    })
}

watch(
  () => props.leaving,
  (leaving, oldLeaving) => {
    if (leaving === true && oldLeaving !== true) {
      leavTransform()
    }
  }
)

// 入场动画
const addTransform = () => {
  const visual = visualRef.value
  if (!visual) return

  visual.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画
  visual
    .animate(
      [
        // 开始
        { opacity: 0, transform: 'scale(0.3)' },
        // 结束
        { opacity: 1, transform: 'scale(1)' }
      ],
      { duration: AG_DURATION_ENTER, easing: AG_EASING_ENTER, delay: 0 }
    )
    .finished.then((animate) => saveStyles(animate))
    .catch(() => {})
}

onMounted(() => {
  addTransform()
})
</script>

<style scoped>
.pr-adaptive-grid-item-position {
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
.pr-adaptive-grid-item-size {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transform-origin: center center;
  cursor: grab;
  touch-action: none;
}
.pr-adaptive-grid-item-visual {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  transform-origin: center center;
  cursor: grab;
  touch-action: none;
  opacity: 0;
  transform: scale(0.3);
}

.pr-adaptive-grid-item-pinned {
  z-index: 20;
}

.pr-adaptive-grid-item-dragging {
  z-index: 25; /* 高于 pinned 的 20 */
  cursor: grabbing;
}
</style>
