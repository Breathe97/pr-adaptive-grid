import { Layout } from '../types'

export const getLayout = (length: number): Layout => {
  const COLS = 5 // ???
  const ROWS = 3 // ???

  let itemsNum = COLS * ROWS // ??????item

  let surplusItemsNum = Math.max(0, length - itemsNum) // ??items

  // ?????????
  while (true) {
    if (surplusItemsNum % (COLS - 1) === 0) break
    itemsNum -= 1
    surplusItemsNum += 1
  }

  // console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: mainIds`, mainIds)
  // console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: surplusIds`, surplusIds)

  const layout: Layout = { gap: 8, cols: 1, rows: 1, items: [] }

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
          layout.rows = 1
          layout.items = [
            //
            { x: 1, y: 1, w: 1, h: 1 },
            { x: 2, y: 1, w: 1, h: 1 }
          ]
        }
        break
      case 3:
        {
          layout.cols = 3
          layout.rows = 1
          layout.items = [
            //
            { x: 1, y: 1, w: 1, h: 1 },
            { x: 2, y: 1, w: 1, h: 1 },
            { x: 3, y: 1, w: 1, h: 1 }
          ]
        }
        break
      case 4:
        {
          layout.cols = 2
          layout.rows = 2
          layout.items = [
            //
            { x: 1, y: 1, w: 1, h: 1 },
            { x: 2, y: 1, w: 1, h: 1 },

            { x: 1, y: 2, w: 1, h: 1 },
            { x: 2, y: 2, w: 1, h: 1 }
          ]
        }
        break
      case 5:
        {
          layout.cols = 6
          layout.rows = 2
          layout.items = [
            //
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
            //
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
          layout.cols = 12
          layout.rows = 2
          layout.items = [
            //
            { x: 1, y: 1, w: 4, h: 1 },
            { x: 5, y: 1, w: 4, h: 1 },
            { x: 9, y: 1, w: 4, h: 1 },

            { x: 1, y: 2, w: 3, h: 1 },
            { x: 4, y: 2, w: 3, h: 1 },
            { x: 7, y: 2, w: 3, h: 1 },
            { x: 10, y: 2, w: 3, h: 1 }
          ]
        }
        break
      case 8:
        {
          layout.cols = 4
          layout.rows = 2
          layout.items = [
            //
            { x: 1, y: 1, w: 1, h: 1 },
            { x: 2, y: 1, w: 1, h: 1 },
            { x: 3, y: 1, w: 1, h: 1 },
            { x: 4, y: 1, w: 1, h: 1 },

            { x: 1, y: 2, w: 1, h: 1 },
            { x: 2, y: 2, w: 1, h: 1 },
            { x: 3, y: 2, w: 1, h: 1 },
            { x: 4, y: 2, w: 1, h: 1 }
          ]
        }
        break
      case 9:
        {
          layout.cols = 3
          layout.rows = 3
          layout.items = [
            //
            { x: 1, y: 1, w: 1, h: 1 },
            { x: 2, y: 1, w: 1, h: 1 },
            { x: 3, y: 1, w: 1, h: 1 },

            { x: 1, y: 2, w: 1, h: 1 },
            { x: 2, y: 2, w: 1, h: 1 },
            { x: 3, y: 2, w: 1, h: 1 },

            { x: 1, y: 3, w: 1, h: 1 },
            { x: 2, y: 3, w: 1, h: 1 },
            { x: 3, y: 3, w: 1, h: 1 }
          ]
        }
        break
      case 10:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            //
            { x: 1, y: 1, w: 4, h: 1 },
            { x: 5, y: 1, w: 4, h: 1 },
            { x: 9, y: 1, w: 4, h: 1 },

            { x: 1, y: 2, w: 4, h: 1 },
            { x: 5, y: 2, w: 4, h: 1 },
            { x: 9, y: 2, w: 4, h: 1 },

            { x: 1, y: 3, w: 3, h: 1 },
            { x: 4, y: 3, w: 3, h: 1 },
            { x: 7, y: 3, w: 3, h: 1 },
            { x: 10, y: 3, w: 3, h: 1 }
          ]
        }
        break
      case 11:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            //
            { x: 1, y: 1, w: 4, h: 1 },
            { x: 5, y: 1, w: 4, h: 1 },
            { x: 9, y: 1, w: 4, h: 1 },

            { x: 1, y: 2, w: 3, h: 1 },
            { x: 4, y: 2, w: 3, h: 1 },
            { x: 7, y: 2, w: 3, h: 1 },
            { x: 10, y: 2, w: 3, h: 1 },

            { x: 1, y: 3, w: 3, h: 1 },
            { x: 4, y: 3, w: 3, h: 1 },
            { x: 7, y: 3, w: 3, h: 1 },
            { x: 10, y: 3, w: 3, h: 1 }
          ]
        }
        break
      case 12:
        {
          layout.cols = 20
          layout.rows = 3
          layout.items = [
            //
            { x: 1, y: 1, w: 5, h: 1 },
            { x: 6, y: 1, w: 5, h: 1 },
            { x: 11, y: 1, w: 5, h: 1 },
            { x: 16, y: 1, w: 5, h: 1 },

            { x: 1, y: 2, w: 5, h: 1 },
            { x: 6, y: 2, w: 5, h: 1 },
            { x: 11, y: 2, w: 5, h: 1 },
            { x: 16, y: 2, w: 5, h: 1 },

            { x: 1, y: 3, w: 5, h: 1 },
            { x: 6, y: 3, w: 5, h: 1 },
            { x: 11, y: 3, w: 5, h: 1 },
            { x: 16, y: 3, w: 5, h: 1 }
          ]
        }
        break
      case 13:
        {
          layout.cols = 20
          layout.rows = 3
          layout.items = [
            //
            { x: 1, y: 1, w: 5, h: 1 },
            { x: 6, y: 1, w: 5, h: 1 },
            { x: 11, y: 1, w: 5, h: 1 },
            { x: 16, y: 1, w: 5, h: 1 },

            { x: 1, y: 2, w: 5, h: 1 },
            { x: 6, y: 2, w: 5, h: 1 },
            { x: 11, y: 2, w: 5, h: 1 },
            { x: 16, y: 2, w: 5, h: 1 },

            { x: 1, y: 3, w: 4, h: 1 },
            { x: 5, y: 3, w: 4, h: 1 },
            { x: 9, y: 3, w: 4, h: 1 },
            { x: 13, y: 3, w: 4, h: 1 },
            { x: 17, y: 3, w: 4, h: 1 }
          ]
        }
        break
      case 14:
        {
          layout.cols = 20
          layout.rows = 3
          layout.items = [
            //
            { x: 1, y: 1, w: 5, h: 1 },
            { x: 6, y: 1, w: 5, h: 1 },
            { x: 11, y: 1, w: 5, h: 1 },
            { x: 16, y: 1, w: 5, h: 1 },

            { x: 1, y: 2, w: 4, h: 1 },
            { x: 5, y: 2, w: 4, h: 1 },
            { x: 9, y: 2, w: 4, h: 1 },
            { x: 13, y: 2, w: 4, h: 1 },
            { x: 17, y: 2, w: 4, h: 1 },

            { x: 1, y: 3, w: 4, h: 1 },
            { x: 5, y: 3, w: 4, h: 1 },
            { x: 9, y: 3, w: 4, h: 1 },
            { x: 13, y: 3, w: 4, h: 1 },
            { x: 17, y: 3, w: 4, h: 1 }
          ]
        }
        break
      case 15:
        {
          layout.cols = 20
          layout.rows = 3
          layout.items = [
            //
            { x: 1, y: 1, w: 4, h: 1 },
            { x: 5, y: 1, w: 4, h: 1 },
            { x: 9, y: 1, w: 4, h: 1 },
            { x: 13, y: 1, w: 4, h: 1 },
            { x: 17, y: 1, w: 4, h: 1 },

            { x: 1, y: 2, w: 4, h: 1 },
            { x: 5, y: 2, w: 4, h: 1 },
            { x: 9, y: 2, w: 4, h: 1 },
            { x: 13, y: 2, w: 4, h: 1 },
            { x: 17, y: 2, w: 4, h: 1 },

            { x: 1, y: 3, w: 4, h: 1 },
            { x: 5, y: 3, w: 4, h: 1 },
            { x: 9, y: 3, w: 4, h: 1 },
            { x: 13, y: 3, w: 4, h: 1 },
            { x: 17, y: 3, w: 4, h: 1 }
          ]
        }
        break
    }
  }

  createMain()

  const createSurplus = () => {
    if (surplusItemsNum === 0) return

    if (surplusItemsNum % 4 === 0) {
      let x = 1
      let y = ROWS + 1

      while (true) {
        if (surplusItemsNum === 0) break
        if (x === 21) {
          x = 1
          y++
        }

        const item = { x, y, w: 5, h: 1 }
        layout.items.push(item)
        x += 5
      }
    }

    if (surplusItemsNum % 5 === 0) {
      let x = 1
      let y = ROWS + 1

      while (true) {
        if (surplusItemsNum === 0) break
        if (x === 21) {
          x = 1
          y++
        }
        const item = { x, y, w: 5, h: 1 }
        layout.items.push(item)
        x += 4
      }
    }
  }

  createSurplus()

  return layout
}
