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
  stickyGeo: {
    required: false,
    type: Object as PropType<Geo>,
    default: undefined
  },
  draggable: {
    required: false,
    type: Boolean,
    default: () => false
  },
  sticky: {
    required: false,
    type: Boolean,
    default: () => false
  },
  fixed: {
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

const isPositionAnimating = ref(false)
const isSettlingAfterDrag = ref(false)
const POSITION_ANIMATING_Z_INDEX = 21
const SETTLING_AFTER_DRAG_Z_INDEX = 25

/** 当前实际用于渲染的几何；拖拽优先，其次 sticky 视觉吸附，最后使用原始占位。 */
const EffectiveGeo = computed(() => props.dragGeo ?? props.stickyGeo ?? props.geo)

/** 暴露给默认插槽的 item 信息。 */
const Info = computed(() => {
  const { id, sticky, fixed } = props
  const geo = EffectiveGeo.value
  const info = { id, ...geo, sticky, fixed }
  return info
})

/** 根据退场、拖拽和 pointer 捕获状态生成根节点 class。 */
const ItemClass = computed(() => {
  return {
    'pr-adaptive-grid-item-leaving': props.leaving,
    'pr-adaptive-grid-item-pinned': props.sticky,
    'pr-adaptive-grid-item-fixed': props.fixed,
    'pr-adaptive-grid-item-dragging': props.dragging,
    'pr-adaptive-grid-item-settling': isSettlingAfterDrag.value,
    'pr-adaptive-grid-item-active-pointer': activePointerId.value !== undefined
  }
})

/** position 层只负责中心点定位和层级。 */
const ItemStyle = computed(() => {
  const { cx, cy } = EffectiveGeo.value
  return {
    'z-index': props.dragging ? 22 : isSettlingAfterDrag.value ? SETTLING_AFTER_DRAG_Z_INDEX : isPositionAnimating.value ? POSITION_ANIMATING_Z_INDEX : undefined, // 交给 CSS class 决定：普通 2 / pinned 20
    transform: `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`
  }
})

/** size 层只负责宽高，避免尺寸动画和位移动画互相影响。 */
const ItemInnerStyle = computed(() => {
  const { width, height } = EffectiveGeo.value
  return {
    width: `${width}px`,
    height: `${height}px`
  }
})

/** 将 WAAPI 动画的当前状态提交到内联样式后停止动画。 */
const saveStyles = (animate: Animation) => {
  if (animate.playState === 'idle') return
  animate.commitStyles()
  animate.cancel()
}

/** 拖拽开始前停止 position 层动画，避免布局动画和指针跟随竞争。 */
const stopPositionAnimations = () => {
  const outer = positionRef.value
  if (!outer) return
  outer.getAnimations().forEach((animate) => saveStyles(animate))
}

/** 释放当前 pointer capture。 */
const releasePointerCapture = (event: PointerEvent) => {
  const visual = visualRef.value
  if (!visual?.hasPointerCapture(event.pointerId)) return
  visual.releasePointerCapture(event.pointerId)
}

/** pointerdown：捕获当前指针并通知父组件进入拖拽。 */
const onPointerDown = (event: PointerEvent) => {
  if (!props.draggable || props.leaving) return

  activePointerId.value = event.pointerId
  visualRef.value?.setPointerCapture(event.pointerId)
  props.onDragStart?.(props.id, event)
}

/** pointermove：只响应当前捕获的指针，交给父组件计算拖拽位置。 */
const onPointerMove = (event: PointerEvent) => {
  if (activePointerId.value !== event.pointerId) return
  props.onDragMove?.(props.id, event)
}

/** pointerup：结束当前指针捕获并通知父组件释放拖拽。 */
const onPointerUp = (event: PointerEvent) => {
  if (activePointerId.value !== event.pointerId) return
  activePointerId.value = undefined
  releasePointerCapture(event)
  props.onDragEnd?.(props.id, event)
}

/** pointercancel：按释放流程收尾，避免浏览器取消事件后残留拖拽态。 */
const onPointerCancel = (event: PointerEvent) => {
  if (activePointerId.value !== event.pointerId) return
  activePointerId.value = undefined
  releasePointerCapture(event)
  props.onDragEnd?.(props.id, event)
}

type TransformOptions = {
  /** 拖拽松手后的回弹动画，需要高于其它补位 item 的 21。 */
  settlingAfterDrag?: boolean
}

/** 从当前视觉位置过渡到新的 geo，同时处理 position 和 size 两层动画。 */
const toTransform = (newGeo: Geo, options?: TransformOptions) => {
  const outer = positionRef.value
  const inner = sizeRef.value
  if (!outer || !inner) return

  const settlingAfterDrag = options?.settlingAfterDrag === true
  isPositionAnimating.value = true
  isSettlingAfterDrag.value = settlingAfterDrag

  /** 读取当前视觉几何，用作下一段 WAAPI 动画的起点。 */
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

  // 开始新动画前先提交旧动画状态，保证连续重排时不会跳帧。
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
    .finally(() => {
      isPositionAnimating.value = false
      isSettlingAfterDrag.value = false
    })

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

// geo 变化时播放布局补位动画；拖拽项由 dragGeo 直接跟随指针，不参与普通补位。
watch(
  () => ({ ...props.geo }),
  () => {
    if (props.dragging) return
    // 拖拽松手后的回弹由 dragging watch 单独处理，避免 geo 二次触发把层级降回 21。
    if (isSettlingAfterDrag.value) return
    toTransform(EffectiveGeo.value)
  }
)

// 拖拽态切换：进入时停止旧动画，退出时从当前视觉位置过渡到最终 geo。
watch(
  () => props.dragging,
  (dragging, oldDragging) => {
    if (dragging) {
      stopPositionAnimations()
      return
    }
    if (oldDragging) {
      toTransform(EffectiveGeo.value, { settlingAfterDrag: true })
    }
  }
)

/** 播放退场动画，并在完成或中断时通知父组件真正移除 item。 */
const leavTransform = () => {
  const visual = visualRef.value
  if (!visual) {
    props.onLeaveEnd?.(props.id)
    return
  }

  const outer = positionRef.value
  const inner = sizeRef.value
  if (!outer || !inner) return

  /** 获取 visual 当前透明度和缩放，保证退场动画可以从当前状态衔接。 */
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

/** 播放入场/恢复动画，让 visual 从当前状态回到完整显示。 */
const addTransform = () => {
  const visual = visualRef.value
  if (!visual) return

  /** 获取 visual 当前透明度和缩放，避免打断退场后恢复时产生跳变。 */
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
      { duration: AG_DURATION_ENTER, easing: AG_EASING_ENTER, delay: 100 }
    )
    .finished.then((animate) => saveStyles(animate))
    .catch(() => {})
}

// leaving 变化时切换进出场动画。
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

// 首次挂载时播放入场动画。
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
  transform: scale(0.3) translate3d(0, 100px, 0);
}

.pr-adaptive-grid-item-pinned {
  z-index: 20;
}

.pr-adaptive-grid-item-fixed .pr-adaptive-grid-item-size,
.pr-adaptive-grid-item-fixed .pr-adaptive-grid-item-visual {
  cursor: default;
}

.pr-adaptive-grid-item-settling,
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
