import { Layout } from '../types'

export const getLayout = (length: number): Layout => {
  const COLS = 2 // 设计列数
  const ROWS = 5 // 设计行数

  let itemsNum = Math.min(length, COLS * ROWS + 1) // 主区格子数（含 Pin 大号位）

  let surplusItemsNum = Math.max(0, length - itemsNum) // 超出主区的 item 数

  const layout: Layout = { gap: 8, cols: 1, rows: 1, items: [] }

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
            { x: 1, y: 1, w: 9, h: 1 },
            { x: 10, y: 1, w: 3, h: 1 }
          ]
        }
        break
      case 3:
        {
          layout.cols = 12
          layout.rows = 2
          layout.items = [
            { x: 1, y: 1, w: 9, h: 2 },
            { x: 10, y: 1, w: 3, h: 1 },
            { x: 10, y: 2, w: 3, h: 1 }
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
            { x: 3, y: 1, w: 8, h: 2 },
            { x: 1, y: 1, w: 2, h: 1 },
            { x: 1, y: 2, w: 2, h: 1 },
            { x: 11, y: 1, w: 2, h: 1 },
            { x: 11, y: 2, w: 2, h: 1 }
          ]
        }
        break
      case 6:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            { x: 1, y: 1, w: 8, h: 3 },

            { x: 9, y: 1, w: 2, h: 1 },
            { x: 11, y: 1, w: 2, h: 1 },
            { x: 9, y: 2, w: 4, h: 1 },
            { x: 9, y: 3, w: 2, h: 1 },
            { x: 11, y: 3, w: 2, h: 1 }
          ]
        }
        break
      case 7:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            { x: 3, y: 1, w: 8, h: 3 },
            { x: 1, y: 1, w: 2, h: 1 },
            { x: 1, y: 2, w: 2, h: 1 },
            { x: 1, y: 3, w: 2, h: 1 },
            { x: 11, y: 1, w: 2, h: 1 },
            { x: 11, y: 2, w: 2, h: 1 },
            { x: 11, y: 3, w: 2, h: 1 }
          ]
        }
        break
      case 8:
        {
          layout.cols = 12
          layout.rows = 12
          layout.items = [
            { x: 4, y: 1, w: 7, h: 12 },
            { x: 1, y: 1, w: 3, h: 4 },
            { x: 1, y: 5, w: 3, h: 4 },
            { x: 1, y: 9, w: 3, h: 4 },
            { x: 11, y: 1, w: 2, h: 3 },
            { x: 11, y: 4, w: 2, h: 3 },
            { x: 11, y: 7, w: 2, h: 3 },
            { x: 11, y: 10, w: 2, h: 3 }
          ]
        }
        break
      case 9:
        {
          layout.cols = 12
          layout.rows = 4
          layout.items = [
            { x: 3, y: 1, w: 8, h: 4 },
            { x: 1, y: 1, w: 2, h: 1 },
            { x: 1, y: 2, w: 2, h: 1 },
            { x: 1, y: 3, w: 2, h: 1 },
            { x: 1, y: 4, w: 2, h: 1 },
            { x: 11, y: 1, w: 2, h: 1 },
            { x: 11, y: 2, w: 2, h: 1 },
            { x: 11, y: 3, w: 2, h: 1 },
            { x: 11, y: 4, w: 2, h: 1 }
          ]
        }
        break
      case 10:
        {
          layout.cols = 15
          layout.rows = 11
          layout.items = [
            { x: 1, y: 1, w: 11, h: 11 },
            { x: 12, y: 5, w: 4, h: 3 },
            { x: 12, y: 1, w: 2, h: 2 },
            { x: 14, y: 1, w: 2, h: 2 },
            { x: 12, y: 3, w: 2, h: 2 },
            { x: 14, y: 3, w: 2, h: 2 },
            { x: 12, y: 8, w: 2, h: 2 },
            { x: 14, y: 8, w: 2, h: 2 },
            { x: 12, y: 10, w: 2, h: 2 },
            { x: 14, y: 10, w: 2, h: 2 }
          ]
        }
        break
      case 11:
        {
          layout.cols = 15
          layout.rows = 5
          layout.items = [
            { x: 1, y: 1, w: 11, h: 5 },
            { x: 12, y: 1, w: 2, h: 1 },
            { x: 14, y: 1, w: 2, h: 1 },
            { x: 12, y: 2, w: 2, h: 1 },
            { x: 14, y: 2, w: 2, h: 1 },
            { x: 12, y: 3, w: 2, h: 1 },
            { x: 14, y: 3, w: 2, h: 1 },
            { x: 12, y: 4, w: 2, h: 1 },
            { x: 14, y: 4, w: 2, h: 1 },
            { x: 12, y: 5, w: 2, h: 1 },
            { x: 14, y: 5, w: 2, h: 1 }
          ]
        }
        break
    }
  }

  createMain()

  const createSurplus = () => {
    if (surplusItemsNum === 0) return

    let x = 12
    let y = ROWS + 1

    while (true) {
      if (surplusItemsNum === 0) break
      if (x === 16) {
        x = 12
        y++
      }

      let w = 2
      if (surplusItemsNum === 1 && x === 12) {
        w = 4
        x = 12
      }
      const item = { x, y, w, h: 1 }
      layout.items.push(item)
      surplusItemsNum -= 1
      x += 2
    }
  }

  createSurplus()

  return layout
}
