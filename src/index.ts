import PrAdaptiveGrid from './components/PrAdaptiveGrid/PrAdaptiveGrid.vue' // 引入封装好的组件
export * from './types.ts'
export * from './getLayout.ts'

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
