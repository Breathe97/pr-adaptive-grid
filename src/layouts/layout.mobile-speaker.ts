import { Layout } from '../types'

export const getLayout = (length: number): Layout => {
  const COLS = 2 // 设计列数

  let itemsNum = Math.min(length, 5) // 主区可容纳的 item 数

  let surplusItemsNum = Math.max(0, length - itemsNum) // 超出主区的 item 数

  // 缩减主区格数，直到余数能被 COLS 整除
  while (true) {
    if (surplusItemsNum % COLS === 0) break
    itemsNum -= 1
    surplusItemsNum += 1
  }

  const layout: Layout = { gap: 8, cols: 1, rows: 1, items: [] }

  // 创建主区
  const createMain = () => {
    switch (itemsNum) {
      case 1:
        {
          layout.cols = 1
          layout.rows = 1
          layout.items = [
            //
            { x: 1, y: 1, w: 1, h: 1 }
          ]
        }
        break
      case 2:
        {
          layout.cols = 2
          layout.rows = 3
          layout.items = [
            { x: 1, y: 1, w: 2, h: 2 },
            { x: 1, y: 3, w: 2, h: 1 }
          ]
        }
        break
      case 3:
        {
          layout.cols = 2
          layout.rows = 4
          layout.items = [
            { x: 2, y: 4, w: 1, h: 1 },
            { x: 1, y: 1, w: 2, h: 3 },
            { x: 1, y: 4, w: 1, h: 1 }
          ]
        }
        break
      case 4:
        {
          layout.cols = 2
          layout.rows = 6
          layout.items = [
            { x: 1, y: 1, w: 2, h: 4 },
            { x: 2, y: 5, w: 1, h: 2 },
            { x: 1, y: 5, w: 1, h: 1 },
            { x: 1, y: 6, w: 1, h: 1 }
          ]
        }
        break
      case 5:
        {
          layout.cols = 2
          layout.rows = 6
          layout.items = [
            { x: 1, y: 1, w: 2, h: 4 },
            { x: 1, y: 5, w: 1, h: 1 },
            { x: 2, y: 5, w: 1, h: 1 },
            { x: 2, y: 6, w: 1, h: 1 },
            { x: 1, y: 6, w: 1, h: 1 }
          ]
        }
        break
    }
  }

  createMain()

  // 创建溢出区
  const createSurplus = () => {
    const w = 1
    const resetX = 1 + w * COLS
    let x = 1
    let y = 7

    while (true) {
      if (surplusItemsNum === 0) break
      if (x === resetX) {
        x = 1
        y = y + 1
      }
      const item = { x, y, w, h: 1 }
      layout.items.push(item)
      surplusItemsNum -= 1
      x += w
    }
  }

  createSurplus()
  return layout
}
