import { Layout } from '../types'

export const getLayout = (length: number): Layout => {
  const COLS = 2 // 设计列数

  let itemsNum = Math.min(length, 9) // 主区可容纳的 item 数

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
          layout.items = [{ x: 1, y: 1, w: 1, h: 1 }]
        }
        break
      case 2:
        {
          layout.cols = 12
          layout.rows = 1
          layout.items = [
            { x: 1, y: 1, w: 8, h: 1 },
            { x: 9, y: 1, w: 4, h: 1 }
          ]
        }
        break
      case 3:
        {
          layout.cols = 12
          layout.rows = 2
          layout.items = [
            { x: 1, y: 1, w: 8, h: 2 },
            { x: 9, y: 1, w: 4, h: 1 },
            { x: 9, y: 2, w: 4, h: 1 }
          ]
        }
        break
      case 4:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            { x: 1, y: 1, w: 9, h: 3 },
            { x: 10, y: 1, w: 3, h: 1 },
            { x: 10, y: 2, w: 3, h: 1 },
            { x: 10, y: 3, w: 3, h: 1 }
          ]
        }
        break
      case 5:
        {
          layout.cols = 12
          layout.rows = 2
          layout.items = [
            { x: 1, y: 1, w: 6, h: 2 },
            { x: 7, y: 1, w: 3, h: 1 },
            { x: 10, y: 1, w: 3, h: 1 },
            { x: 10, y: 2, w: 3, h: 1 },
            { x: 7, y: 2, w: 3, h: 1 }
          ]
        }
        break
      case 6:
        {
          layout.cols = 12
          layout.rows = 10
          layout.items = [
            { x: 1, y: 1, w: 8, h: 10 },
            { x: 9, y: 1, w: 4, h: 4 },
            { x: 9, y: 5, w: 2, h: 3 },
            { x: 11, y: 5, w: 2, h: 3 },
            { x: 11, y: 8, w: 2, h: 3 },
            { x: 9, y: 8, w: 2, h: 3 }
          ]
        }
        break
      case 7:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            { x: 1, y: 1, w: 7, h: 3 },
            { x: 8, y: 1, w: 3, h: 1 },
            { x: 11, y: 1, w: 2, h: 1 },
            { x: 11, y: 2, w: 2, h: 1 },
            { x: 8, y: 2, w: 3, h: 1 },
            { x: 8, y: 3, w: 3, h: 1 },
            { x: 11, y: 3, w: 2, h: 1 }
          ]
        }
        break
      case 8:
        {
          layout.cols = 12
          layout.rows = 12
          layout.items = [
            { x: 1, y: 1, w: 8, h: 12 },

            { x: 9, y: 1, w: 2, h: 4 },
            { x: 11, y: 1, w: 2, h: 3 },
            { x: 11, y: 4, w: 2, h: 3 },
            { x: 9, y: 5, w: 2, h: 4 },
            { x: 11, y: 7, w: 2, h: 3 },
            { x: 9, y: 9, w: 2, h: 4 },
            { x: 11, y: 10, w: 2, h: 3 }
          ]
        }
        break
      case 9:
        {
          layout.cols = 12
          layout.rows = 12
          layout.items = [
            { x: 1, y: 1, w: 8, h: 12 },

            { x: 9, y: 1, w: 2, h: 3 },
            { x: 11, y: 1, w: 2, h: 3 },
            { x: 11, y: 4, w: 2, h: 3 },
            { x: 9, y: 4, w: 2, h: 3 },
            { x: 9, y: 7, w: 2, h: 3 },
            { x: 11, y: 7, w: 2, h: 3 },
            { x: 11, y: 10, w: 2, h: 3 },
            { x: 9, y: 10, w: 2, h: 3 }
          ]
        }
        break
    }
  }

  createMain()

  // 创建溢出区
  const createSurplus = () => {
    const w = 2
    const startX = layout.items[0].w + 1
    const resetX = 9 + w * COLS
    let x = startX
    let y = 13

    while (true) {
      if (surplusItemsNum === 0) break
      if (x === resetX) {
        x = startX
        y = y + 3
      }
      const item = { x, y, w, h: 3 }
      layout.items.push(item)
      surplusItemsNum -= 1
      x += w
    }
  }

  createSurplus()
  return layout
}
