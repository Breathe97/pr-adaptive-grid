import PrAdaptiveGrid from './components/PrAdaptiveGrid/PrAdaptiveGrid.vue' // 引入封装好的组件
import { getLayout as pcSpeakerLayout } from './layouts/layout.pc-speaker'
import { getLayout as pcGridLayout } from './layouts/layout.pc-grid'
import { getLayout as ipadSpeakerLayout } from './layouts/layout.ipad-speaker'
import { getLayout as ipadGridLayout } from './layouts/layout.ipad-grid'
import { getLayout as mobileSpeakerLayout } from './layouts/layout.mobile-speaker'
import { getLayout as mobileGridLayout } from './layouts/layout.mobile-grid'

// 内置布局（6 个）：主讲模式 / 平铺模式 × PC / iPad / Mobile
export { pcSpeakerLayout, pcGridLayout, ipadSpeakerLayout, ipadGridLayout, mobileSpeakerLayout, mobileGridLayout }

/** 按「设备维度 → 模式」两级索引的内置布局，便于按断点 + 模式映射 */
export const layouts = {
  pc: { speaker: pcSpeakerLayout, grid: pcGridLayout },
  ipad: { speaker: ipadSpeakerLayout, grid: ipadGridLayout },
  mobile: { speaker: mobileSpeakerLayout, grid: mobileGridLayout }
}

// 自定义布局工厂
export { createLayout } from './layouts/createLayout'

export * from './types.ts'

// 按需引入
export { PrAdaptiveGrid }

const component = [PrAdaptiveGrid]

export default {
  install(App: any) {
    component.forEach((item) => {
      App.component(item.__name, item)
    })
  }
}
