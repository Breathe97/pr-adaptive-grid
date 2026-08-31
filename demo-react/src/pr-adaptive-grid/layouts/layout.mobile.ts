import { Layout } from '../types'

export const getLayout = (length: number): Layout => {
  const COLS = 3 // 设计列数
  const ROWS = 3 // 设计行数

  let itemsNum = Math.min(length, COLS * ROWS) // 主区可容纳的 item 数

  let surplusItemsNum = Math.max(0, length - itemsNum) // 超出主区的 item 数
  // 缩减主区格数，直到余数能被 (COLS ) 整除
  while (true) {
    if (surplusItemsNum % COLS === 0) break
    itemsNum -= 1
    surplusItemsNum += 1
  }

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
          layout.cols = 2
          layout.rows = 1
          layout.items = [
            { x: 1, y: 1, w: 1, h: 1 },
            { x: 2, y: 1, w: 1, h: 1 }
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
          layout.cols = 2
          layout.rows = 2
          layout.items = [
            { x: 1, y: 1, w: 1, h: 1 },
            { x: 1, y: 2, w: 1, h: 1 },
            { x: 2, y: 1, w: 1, h: 1 },
            { x: 2, y: 2, w: 1, h: 1 }
          ]
        }
        break
      case 5:
        {
          layout.cols = 6
          layout.rows = 2
          layout.items = [
            { x: 1, y: 1, w: 3, h: 1 },
            { x: 4, y: 1, w: 3, h: 1 },

            { x: 1, y: 2, w: 2, h: 1 },
            { x: 3, y: 2, w: 2, h: 1 },
            { x: 5, y: 2, w: 2, h: 1 }
          ]
        }
        break
      case 6:
        {
          layout.cols = 3
          layout.rows = 2
          layout.items = [
            { x: 1, y: 1, w: 1, h: 1 },
            { x: 2, y: 1, w: 1, h: 1 },
            { x: 3, y: 1, w: 1, h: 1 },

            { x: 1, y: 2, w: 1, h: 1 },
            { x: 2, y: 2, w: 1, h: 1 },
            { x: 3, y: 2, w: 1, h: 1 }
          ]
        }
        break
      case 7:
        {
          layout.cols = 6
          layout.rows = 3
          layout.items = [
            { x: 1, y: 1, w: 3, h: 1 },
            { x: 4, y: 1, w: 3, h: 1 },
            { x: 1, y: 2, w: 3, h: 1 },
            { x: 4, y: 2, w: 3, h: 1 },
            { x: 1, y: 3, w: 2, h: 1 },
            { x: 3, y: 3, w: 2, h: 1 },
            { x: 5, y: 3, w: 2, h: 1 }
          ]
        }
        break
      case 8:
        {
          layout.cols = 6
          layout.rows = 3
          layout.items = [
            { x: 1, y: 1, w: 3, h: 1 },
            { x: 4, y: 1, w: 3, h: 1 },
            { x: 1, y: 2, w: 2, h: 1 },
            { x: 3, y: 2, w: 2, h: 1 },
            { x: 5, y: 2, w: 2, h: 1 },
            { x: 1, y: 3, w: 2, h: 1 },
            { x: 3, y: 3, w: 2, h: 1 },
            { x: 5, y: 3, w: 2, h: 1 }
          ]
        }
        break
      case 9:
        {
          layout.cols = 6
          layout.rows = 3
          layout.items = [
            { x: 1, y: 1, w: 2, h: 1 },
            { x: 3, y: 1, w: 2, h: 1 },
            { x: 5, y: 1, w: 2, h: 1 },
            { x: 1, y: 2, w: 2, h: 1 },
            { x: 3, y: 2, w: 2, h: 1 },
            { x: 5, y: 2, w: 2, h: 1 },
            { x: 1, y: 3, w: 2, h: 1 },
            { x: 3, y: 3, w: 2, h: 1 },
            { x: 5, y: 3, w: 2, h: 1 }
          ]
        }
        break
    }
  }

  createMain()
  const createSurplus = () => {
    if (surplusItemsNum === 0) return

    if (surplusItemsNum % 3 === 0) {
      let x = 1
      let y = ROWS + 1

      while (true) {
        if (surplusItemsNum === 0) break
        if (x === 7) {
          x = 1
          y++
        }
        const item = { x, y, w: 2, h: 1 }
        layout.items.push(item)
        surplusItemsNum -= 1
        x += 2
      }
    }
  }

  createSurplus()

  return layout
}
