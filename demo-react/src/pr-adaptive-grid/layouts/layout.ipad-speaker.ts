import { Layout } from '../types'

export const getLayout = (length: number): Layout => {
  const COLS = 3 // 设计列数

  let itemsNum = Math.min(length, 10) // 主区可容纳的 item 数

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
          layout.cols = 1
          layout.rows = 3
          layout.items = [
            { x: 1, y: 1, w: 1, h: 2 },
            { x: 1, y: 3, w: 1, h: 1 }
          ]
        }
        break
      case 3:
        {
          layout.cols = 2
          layout.rows = 3
          layout.items = [
            { x: 1, y: 1, w: 2, h: 2 },
            { x: 1, y: 3, w: 1, h: 1 },
            { x: 2, y: 3, w: 1, h: 1 }
          ]
        }
        break
      case 4:
        {
          layout.cols = 3
          layout.rows = 4
          layout.items = [
            { x: 1, y: 1, w: 3, h: 3 },
            { x: 1, y: 4, w: 1, h: 1 },
            { x: 2, y: 4, w: 1, h: 1 },
            { x: 3, y: 4, w: 1, h: 1 }
          ]
        }
        break
      case 5:
        {
          layout.cols = 6
          layout.rows = 7
          layout.items = [
            { x: 1, y: 1, w: 6, h: 3 },
            { x: 1, y: 4, w: 3, h: 2 },
            { x: 4, y: 4, w: 3, h: 2 },
            { x: 1, y: 6, w: 3, h: 2 },
            { x: 4, y: 6, w: 3, h: 2 }
          ]
        }
        break
      case 6:
        {
          layout.cols = 12
          layout.rows = 5
          layout.items = [
            { x: 1, y: 1, w: 8, h: 5 },
            { x: 9, y: 1, w: 4, h: 1 },
            { x: 9, y: 2, w: 4, h: 1 },
            { x: 9, y: 3, w: 4, h: 1 },
            { x: 9, y: 4, w: 4, h: 1 },
            { x: 9, y: 5, w: 4, h: 1 }
          ]
        }
        break
      case 7:
        {
          layout.cols = 12
          layout.rows = 8
          layout.items = [
            { x: 1, y: 1, w: 8, h: 6 },
            { x: 9, y: 1, w: 4, h: 2 },
            { x: 9, y: 3, w: 4, h: 2 },
            { x: 9, y: 5, w: 4, h: 2 },
            { x: 9, y: 7, w: 4, h: 2 },
            { x: 5, y: 7, w: 4, h: 2 },
            { x: 1, y: 7, w: 4, h: 2 }
          ]
        }
        break
      case 8:
        {
          layout.cols = 12
          layout.rows = 12
          layout.items = [
            { x: 1, y: 1, w: 9, h: 6 },
            { x: 10, y: 1, w: 3, h: 2 },
            { x: 10, y: 3, w: 3, h: 2 },
            { x: 10, y: 5, w: 3, h: 2 },
            { x: 7, y: 7, w: 6, h: 3 },
            { x: 1, y: 7, w: 6, h: 3 },
            { x: 1, y: 10, w: 6, h: 3 },
            { x: 7, y: 10, w: 6, h: 3 }
          ]
        }
        break
      case 9:
        {
          layout.cols = 12
          layout.rows = 12
          layout.items = [
            { x: 1, y: 1, w: 8, h: 6 },
            { x: 9, y: 1, w: 4, h: 3 },
            { x: 9, y: 4, w: 4, h: 3 },
            { x: 9, y: 7, w: 4, h: 3 },
            { x: 5, y: 7, w: 4, h: 3 },
            { x: 1, y: 7, w: 4, h: 3 },
            { x: 1, y: 10, w: 4, h: 3 },
            { x: 5, y: 10, w: 4, h: 3 },
            { x: 9, y: 10, w: 4, h: 3 }
          ]
        }
        break
      case 10:
        {
          layout.cols = 12
          layout.rows = 12
          layout.items = [
            { x: 1, y: 1, w: 9, h: 6 },
            { x: 10, y: 1, w: 3, h: 2 },
            { x: 10, y: 3, w: 3, h: 2 },
            { x: 10, y: 5, w: 3, h: 2 },
            { x: 9, y: 7, w: 4, h: 3 },
            { x: 5, y: 7, w: 4, h: 3 },
            { x: 1, y: 7, w: 4, h: 3 },
            { x: 1, y: 10, w: 4, h: 3 },
            { x: 5, y: 10, w: 4, h: 3 },
            { x: 9, y: 10, w: 4, h: 3 }
          ]
        }
        break
    }
  }

  createMain()

  // 创建溢出区
  const createSurplus = () => {
    const w = 4
    const startX = 1
    const resetX = 13
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
