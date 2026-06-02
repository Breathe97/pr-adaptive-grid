import PrAdaptiveGrid from './components/PrAdaptiveGrid/PrAdaptiveGrid.vue'
export * from './types.ts'
export { packRowCounts } from './components/PrAdaptiveGrid/packRowCounts'
export { resolveGridSizeSpec, resolveGridInsets } from './components/PrAdaptiveGrid/resolveGridSize'

export { PrAdaptiveGrid }

const component = [PrAdaptiveGrid]

export default {
  install(App: any) {
    component.forEach((item) => {
      App.component(item.__name, item)
    })
  }
}
