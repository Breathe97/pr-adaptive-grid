import PrAdaptiveGrid from './components/PrAdaptiveGrid/PrAdaptiveGrid.vue' // 引入封装好的组件
export { getLayout } from './layouts/layout.default'
export { getLayout as getLectureLayout } from './layouts/layout.lecture'
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
