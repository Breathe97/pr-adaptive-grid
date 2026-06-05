<template>
  <div ref="positionRef" class="pr-adaptive-grid-item-position" :class="ItemClass" :style="[ItemStyle]">
    <div ref="sizeRef" class="pr-adaptive-grid-item-size" :style="[ItemInnerStyle]">
      <div ref="visualRef" class="pr-adaptive-grid-item-visual" @pointerdown="onPointerDown" @pointermove="onPointerMove" @pointerup="onPointerUp" @pointercancel="onPointerCancel">
        <slot :item="Info" />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch, onMounted } from 'vue'
import type { PropType } from 'vue'
import type { Geo, PrAdaptiveGridItemDragEvent } from '../../types'

const AG_DURATION_ENTER = 500
const AG_EASING_ENTER = 'ease-out'
const AG_DURATION_POSITION = 800
const AG_EASING_POSITION = 'cubic-bezier(0.22, 1, 0.44, 1)'
const AG_DURATION_SIZE = 800
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
  dragGeo: {
    required: false,
    type: Object as PropType<Geo>,
    default: undefined
  },
  draggable: {
    required: false,
    type: Boolean,
    default: () => false
  },
  dragging: {
    required: false,
    type: Boolean,
    default: () => false
  },
  leaving: {
    required: false,
    type: Boolean,
    default: () => false
  },
  onDragStart: {
    required: false,
    type: Function as PropType<PrAdaptiveGridItemDragEvent>,
    default: undefined
  },
  onDragMove: {
    required: false,
    type: Function as PropType<PrAdaptiveGridItemDragEvent>,
    default: undefined
  },
  onDragEnd: {
    required: false,
    type: Function as PropType<PrAdaptiveGridItemDragEvent>,
    default: undefined
  },
  onLeaveEnd: {
    required: false,
    type: Function as PropType<(id: string) => void>,
    default: undefined
  }
})

const positionRef = ref<HTMLElement>()
const sizeRef = ref<HTMLElement>()
const visualRef = ref<HTMLElement>()
const activePointerId = ref<number>()

const EffectiveGeo = computed(() => props.dragGeo ?? props.geo)

const Info = computed(() => {
  const { id } = props
  const geo = EffectiveGeo.value
  const info = { id, ...geo, sticky: true, fixed: true }
  return info
})

const ItemClass = computed(() => {
  return {
    'pr-adaptive-grid-item-leaving': props.leaving,
    'pr-adaptive-grid-item-dragging': props.dragging,
    'pr-adaptive-grid-item-active-pointer': activePointerId.value !== undefined
  }
})

const ItemStyle = computed(() => {
  const { cx, cy } = EffectiveGeo.value
  return {
    'z-index': props.dragging === true ? 100 : 2,
    transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`
  }
})

const ItemInnerStyle = computed(() => {
  const { width, height } = EffectiveGeo.value
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

const stopPositionAnimations = () => {
  const outer = positionRef.value
  if (!outer) return
  outer.getAnimations().forEach((animate) => saveStyles(animate))
}

const releasePointerCapture = (event: PointerEvent) => {
  const visual = visualRef.value
  if (!visual?.hasPointerCapture(event.pointerId)) return
  visual.releasePointerCapture(event.pointerId)
}

const onPointerDown = (event: PointerEvent) => {
  if (!props.draggable || props.leaving) return

  activePointerId.value = event.pointerId
  visualRef.value?.setPointerCapture(event.pointerId)
  props.onDragStart?.(props.id, event)
}

const onPointerMove = (event: PointerEvent) => {
  if (activePointerId.value !== event.pointerId) return
  props.onDragMove?.(props.id, event)
}

const onPointerUp = (event: PointerEvent) => {
  if (activePointerId.value !== event.pointerId) return
  activePointerId.value = undefined
  releasePointerCapture(event)
  props.onDragEnd?.(props.id, event)
}

const onPointerCancel = (event: PointerEvent) => {
  if (activePointerId.value !== event.pointerId) return
  activePointerId.value = undefined
  releasePointerCapture(event)
  props.onDragEnd?.(props.id, event)
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
        { transform: `translate3d(${currentGeo.cx}px, ${currentGeo.cy}px, 0) translate(-50%, -50%)`, zIndex: 100 },
        // 结束
        { transform: `translate3d(${newGeo.cx}px, ${newGeo.cy}px, 0) translate(-50%, -50%)`, zIndex: 2 }
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
  (geo) => {
    if (props.dragging) return
    toTransform(geo)
  }
)

watch(
  () => props.dragging,
  (dragging, oldDragging) => {
    if (dragging) {
      stopPositionAnimations()
      return
    }
    if (oldDragging) {
      toTransform(props.geo)
    }
  }
)

// 退场动画
const leavTransform = () => {
  const visual = visualRef.value
  if (!visual) {
    props.onLeaveEnd?.(props.id)
    return
  }

  const outer = positionRef.value
  const inner = sizeRef.value
  if (!outer || !inner) return

  // 当前进出场信息
  const getCurrentVisualState = () => {
    const visual = visualRef.value
    if (!visual) {
      return {
        opacity: 1,
        transform: 'scale(1)'
      }
    }
    const style = getComputedStyle(visual)

    return {
      opacity: style.opacity,
      transform: style.transform === 'none' ? 'scale(1)' : style.transform
    }
  }

  const current = getCurrentVisualState() // 当前进出场信息

  visual.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画

  const animation = visual.animate(
    [
      { opacity: current.opacity, transform: current.transform },
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

// 入场动画
const addTransform = () => {
  const visual = visualRef.value
  if (!visual) return

  // 当前进出场信息
  const getCurrentVisualState = () => {
    const visual = visualRef.value
    if (!visual) {
      return {
        opacity: 1,
        transform: 'scale(1)'
      }
    }
    const style = getComputedStyle(visual)

    return {
      opacity: style.opacity,
      transform: style.transform === 'none' ? 'scale(1)' : style.transform
    }
  }

  const current = getCurrentVisualState() // 当前进出场信息

  visual.getAnimations().forEach((animate) => saveStyles(animate)) // 暂停动画
  visual
    .animate(
      [
        // 开始
        { opacity: current.opacity, transform: current.transform },
        // 结束
        { opacity: 1, transform: 'scale(1)' }
      ],
      { duration: AG_DURATION_ENTER, easing: AG_EASING_ENTER, delay: 0 }
    )
    .finished.then((animate) => saveStyles(animate))
    .catch(() => {})
}

watch(
  () => props.leaving,
  (leaving, oldLeaving) => {
    if (leaving === true && oldLeaving !== true) {
      leavTransform()
      return
    }
    if (leaving === false && oldLeaving === true) {
      // 取消退场，恢复/入场
      addTransform()
    }
  }
)

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
}
.pr-adaptive-grid-item-dragging,
.pr-adaptive-grid-item-active-pointer,
.pr-adaptive-grid-item-dragging .pr-adaptive-grid-item-size,
.pr-adaptive-grid-item-active-pointer .pr-adaptive-grid-item-size,
.pr-adaptive-grid-item-dragging .pr-adaptive-grid-item-visual,
.pr-adaptive-grid-item-active-pointer .pr-adaptive-grid-item-visual {
  cursor: grabbing;
}
</style>
