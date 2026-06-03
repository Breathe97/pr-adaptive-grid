import { Layout } from './types'

// 布局一
const getLayoutModel1 = (ids: string[]): Layout => {
  const COLS = 5 // 最大列
  const ROWS = 3 // 最大行
  const itemsNum = COLS * ROWS // 首屏最大数量item

  const length = ids.length

  const mainIds = ids.slice(0, itemsNum) // 首页items

  const surplusIds = ids.slice(itemsNum, length) // 剩余items

  // 对最后一行回退补齐
  while (true) {
    if (surplusIds.length % (COLS - 1) === 0) break
    const id = mainIds.pop()
    if (!id) break
    surplusIds.unshift(id)
  }

  // console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: mainIds`, mainIds)
  // console.log('\x1b[38;2;0;151;255m%c%s\x1b[0m', 'color:#0097ff;', `------->Breathe: surplusIds`, surplusIds)

  const layout: Layout = { gap: 8, cols: 1, rows: 1, items: [] }

  const createMain = (mainIds: string[]) => {
    switch (mainIds.length) {
      case 1:
        {
          layout.cols = 1
          layout.rows = 1
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 1, h: 1 }
          ]
        }
        break
      case 2:
        {
          layout.cols = 2
          layout.rows = 1
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 1, h: 1 },
            { id: mainIds[1], x: 2, y: 1, w: 1, h: 1 }
          ]
        }
        break
      case 3:
        {
          layout.cols = 3
          layout.rows = 1
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 1, h: 1 },
            { id: mainIds[1], x: 2, y: 1, w: 1, h: 1 },
            { id: mainIds[2], x: 3, y: 1, w: 1, h: 1 }
          ]
        }
        break
      case 4:
        {
          layout.cols = 2
          layout.rows = 2
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 1, h: 1 },
            { id: mainIds[1], x: 2, y: 1, w: 1, h: 1 },

            { id: mainIds[2], x: 1, y: 2, w: 1, h: 1 },
            { id: mainIds[3], x: 2, y: 2, w: 1, h: 1 }
          ]
        }
        break
      case 5:
        {
          layout.cols = 6
          layout.rows = 2
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 3, h: 1 },
            { id: mainIds[1], x: 4, y: 1, w: 3, h: 1 },

            { id: mainIds[2], x: 1, y: 2, w: 2, h: 1 },
            { id: mainIds[3], x: 3, y: 2, w: 2, h: 1 },
            { id: mainIds[4], x: 5, y: 2, w: 2, h: 1 }
          ]
        }
        break
      case 6:
        {
          layout.cols = 3
          layout.rows = 2
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 1, h: 1 },
            { id: mainIds[1], x: 2, y: 1, w: 1, h: 1 },
            { id: mainIds[2], x: 3, y: 1, w: 1, h: 1 },

            { id: mainIds[3], x: 1, y: 2, w: 1, h: 1 },
            { id: mainIds[4], x: 2, y: 2, w: 1, h: 1 },
            { id: mainIds[5], x: 3, y: 2, w: 1, h: 1 }
          ]
        }
        break
      case 7:
        {
          layout.cols = 12
          layout.rows = 2
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 4, h: 1 },
            { id: mainIds[1], x: 5, y: 1, w: 4, h: 1 },
            { id: mainIds[2], x: 9, y: 1, w: 4, h: 1 },

            { id: mainIds[3], x: 1, y: 2, w: 3, h: 1 },
            { id: mainIds[4], x: 4, y: 2, w: 3, h: 1 },
            { id: mainIds[5], x: 7, y: 2, w: 3, h: 1 },
            { id: mainIds[6], x: 10, y: 2, w: 3, h: 1 }
          ]
        }
        break
      case 8:
        {
          layout.cols = 4
          layout.rows = 2
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 1, h: 1 },
            { id: mainIds[1], x: 2, y: 1, w: 1, h: 1 },
            { id: mainIds[2], x: 3, y: 1, w: 1, h: 1 },
            { id: mainIds[3], x: 4, y: 1, w: 1, h: 1 },

            { id: mainIds[4], x: 1, y: 2, w: 1, h: 1 },
            { id: mainIds[5], x: 2, y: 2, w: 1, h: 1 },
            { id: mainIds[6], x: 3, y: 2, w: 1, h: 1 },
            { id: mainIds[7], x: 4, y: 2, w: 1, h: 1 }
          ]
        }
        break
      case 9:
        {
          layout.cols = 3
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 1, h: 1 },
            { id: mainIds[1], x: 2, y: 1, w: 1, h: 1 },
            { id: mainIds[2], x: 3, y: 1, w: 1, h: 1 },

            { id: mainIds[3], x: 1, y: 2, w: 1, h: 1 },
            { id: mainIds[4], x: 2, y: 2, w: 1, h: 1 },
            { id: mainIds[5], x: 3, y: 2, w: 1, h: 1 },

            { id: mainIds[6], x: 1, y: 3, w: 1, h: 1 },
            { id: mainIds[7], x: 2, y: 3, w: 1, h: 1 },
            { id: mainIds[8], x: 3, y: 3, w: 1, h: 1 }
          ]
        }
        break
      case 10:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 4, h: 1 },
            { id: mainIds[1], x: 5, y: 1, w: 4, h: 1 },
            { id: mainIds[2], x: 9, y: 1, w: 4, h: 1 },

            { id: mainIds[3], x: 1, y: 2, w: 4, h: 1 },
            { id: mainIds[4], x: 5, y: 2, w: 4, h: 1 },
            { id: mainIds[5], x: 9, y: 2, w: 4, h: 1 },

            { id: mainIds[6], x: 1, y: 3, w: 3, h: 1 },
            { id: mainIds[7], x: 4, y: 3, w: 3, h: 1 },
            { id: mainIds[8], x: 7, y: 3, w: 3, h: 1 },
            { id: mainIds[9], x: 10, y: 3, w: 3, h: 1 }
          ]
        }
        break
      case 11:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 4, h: 1 },
            { id: mainIds[1], x: 5, y: 1, w: 4, h: 1 },
            { id: mainIds[2], x: 9, y: 1, w: 4, h: 1 },

            { id: mainIds[3], x: 1, y: 2, w: 3, h: 1 },
            { id: mainIds[4], x: 4, y: 2, w: 3, h: 1 },
            { id: mainIds[5], x: 7, y: 2, w: 3, h: 1 },
            { id: mainIds[6], x: 10, y: 2, w: 3, h: 1 },

            { id: mainIds[7], x: 1, y: 3, w: 3, h: 1 },
            { id: mainIds[8], x: 4, y: 3, w: 3, h: 1 },
            { id: mainIds[9], x: 7, y: 3, w: 3, h: 1 },
            { id: mainIds[10], x: 10, y: 3, w: 3, h: 1 }
          ]
        }
        break
      case 12:
        {
          layout.cols = 20
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 5, h: 1 },
            { id: mainIds[1], x: 6, y: 1, w: 5, h: 1 },
            { id: mainIds[2], x: 11, y: 1, w: 5, h: 1 },
            { id: mainIds[3], x: 16, y: 1, w: 5, h: 1 },

            { id: mainIds[4], x: 1, y: 2, w: 5, h: 1 },
            { id: mainIds[5], x: 6, y: 2, w: 5, h: 1 },
            { id: mainIds[6], x: 11, y: 2, w: 5, h: 1 },
            { id: mainIds[7], x: 16, y: 2, w: 5, h: 1 },

            { id: mainIds[8], x: 1, y: 3, w: 5, h: 1 },
            { id: mainIds[9], x: 6, y: 3, w: 5, h: 1 },
            { id: mainIds[10], x: 11, y: 3, w: 5, h: 1 },
            { id: mainIds[11], x: 16, y: 3, w: 5, h: 1 }
          ]
        }
        break
      case 13:
        {
          layout.cols = 20
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 5, h: 1 },
            { id: mainIds[1], x: 6, y: 1, w: 5, h: 1 },
            { id: mainIds[2], x: 11, y: 1, w: 5, h: 1 },
            { id: mainIds[3], x: 16, y: 1, w: 5, h: 1 },

            { id: mainIds[4], x: 1, y: 2, w: 5, h: 1 },
            { id: mainIds[5], x: 6, y: 2, w: 5, h: 1 },
            { id: mainIds[6], x: 11, y: 2, w: 5, h: 1 },
            { id: mainIds[7], x: 16, y: 2, w: 5, h: 1 },

            { id: mainIds[8], x: 1, y: 3, w: 4, h: 1 },
            { id: mainIds[9], x: 5, y: 3, w: 4, h: 1 },
            { id: mainIds[10], x: 9, y: 3, w: 4, h: 1 },
            { id: mainIds[11], x: 13, y: 3, w: 4, h: 1 },
            { id: mainIds[12], x: 17, y: 3, w: 4, h: 1 }
          ]
        }
        break
      case 14:
        {
          layout.cols = 20
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 5, h: 1 },
            { id: mainIds[1], x: 6, y: 1, w: 5, h: 1 },
            { id: mainIds[2], x: 11, y: 1, w: 5, h: 1 },
            { id: mainIds[3], x: 16, y: 1, w: 5, h: 1 },

            { id: mainIds[4], x: 1, y: 2, w: 4, h: 1 },
            { id: mainIds[5], x: 5, y: 2, w: 4, h: 1 },
            { id: mainIds[6], x: 9, y: 2, w: 4, h: 1 },
            { id: mainIds[7], x: 13, y: 2, w: 4, h: 1 },
            { id: mainIds[8], x: 17, y: 2, w: 4, h: 1 },

            { id: mainIds[9], x: 1, y: 3, w: 4, h: 1 },
            { id: mainIds[10], x: 5, y: 3, w: 4, h: 1 },
            { id: mainIds[11], x: 9, y: 3, w: 4, h: 1 },
            { id: mainIds[12], x: 13, y: 3, w: 4, h: 1 },
            { id: mainIds[13], x: 17, y: 3, w: 4, h: 1 }
          ]
        }
        break
      case 15:
        {
          layout.cols = 20
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 4, h: 1 },
            { id: mainIds[1], x: 5, y: 1, w: 4, h: 1 },
            { id: mainIds[2], x: 9, y: 1, w: 4, h: 1 },
            { id: mainIds[3], x: 13, y: 1, w: 4, h: 1 },
            { id: mainIds[4], x: 17, y: 1, w: 4, h: 1 },

            { id: mainIds[5], x: 1, y: 2, w: 4, h: 1 },
            { id: mainIds[6], x: 5, y: 2, w: 4, h: 1 },
            { id: mainIds[7], x: 9, y: 2, w: 4, h: 1 },
            { id: mainIds[8], x: 13, y: 2, w: 4, h: 1 },
            { id: mainIds[9], x: 17, y: 2, w: 4, h: 1 },

            { id: mainIds[10], x: 1, y: 3, w: 4, h: 1 },
            { id: mainIds[11], x: 5, y: 3, w: 4, h: 1 },
            { id: mainIds[12], x: 9, y: 3, w: 4, h: 1 },
            { id: mainIds[13], x: 13, y: 3, w: 4, h: 1 },
            { id: mainIds[14], x: 17, y: 3, w: 4, h: 1 }
          ]
        }
        break
    }
  }

  createMain(mainIds)

  const createSurplus = (surplusIds: string[]) => {
    if (surplusIds.length === 0) return

    if (surplusIds.length % 4 === 0) {
      let x = 1
      let y = ROWS + 1

      while (true) {
        if (surplusIds.length === 0) break
        if (x === 21) {
          x = 1
          y++
        }
        const id = surplusIds.shift()
        if (!id) break
        const item = { id, x, y, w: 5, h: 1 }
        layout.items.push(item)
        x += 5
      }
    }

    if (surplusIds.length % 5 === 0) {
      let x = 1
      let y = ROWS + 1

      while (true) {
        if (surplusIds.length === 0) break
        if (x === 21) {
          x = 1
          y++
        }
        const id = surplusIds.shift()
        if (!id) break
        const item = { id, x, y, w: 5, h: 1 }
        layout.items.push(item)
        x += 4
      }
    }
  }

  createSurplus(surplusIds)

  return layout
}

// 布局二
const getLayoutModel2 = (ids: string[]): Layout => {
  const COLS = 2 // 最大列
  const ROWS = 5 // 最大行
  const itemsNum = COLS * ROWS + 1 // 首屏最大数量item

  const length = ids.length

  const mainIds = ids.slice(0, itemsNum) // 首页items

  const surplusIds = ids.slice(itemsNum, length) // 剩余items

  // 对最后一行回退补齐
  while (true) {
    if (surplusIds.length % (COLS - 1) === 0) break
    const id = mainIds.pop()
    if (!id) break
    surplusIds.unshift(id)
  }

  const layout: Layout = { gap: 8, cols: 1, rows: 1, items: [] }

  const createMain = (mainIds: string[]) => {
    switch (mainIds.length) {
      case 1:
        {
          layout.cols = 1
          layout.rows = 1
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 1, h: 1 }
          ]
        }
        break
      case 2:
        {
          layout.cols = 12
          layout.rows = 1
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 9, h: 1 },
            //
            { id: mainIds[1], x: 10, y: 1, w: 3, h: 1 }
          ]
        }
        break
      case 3:
        {
          layout.cols = 12
          layout.rows = 2
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 9, h: 2 },
            //
            { id: mainIds[1], x: 10, y: 1, w: 3, h: 1 },
            { id: mainIds[2], x: 10, y: 2, w: 3, h: 1 }
          ]
        }
        break
      case 4:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 9, h: 3 },
            //
            { id: mainIds[1], x: 10, y: 1, w: 3, h: 1 },
            { id: mainIds[2], x: 10, y: 2, w: 3, h: 1 },
            { id: mainIds[3], x: 10, y: 3, w: 3, h: 1 }
          ]
        }
        break
      case 5:
        {
          layout.cols = 12
          layout.rows = 2
          layout.items = [
            //
            { id: mainIds[0], x: 3, y: 1, w: 8, h: 2 },
            //
            { id: mainIds[1], x: 1, y: 1, w: 2, h: 1 },
            { id: mainIds[2], x: 1, y: 2, w: 2, h: 1 },
            //
            { id: mainIds[3], x: 11, y: 1, w: 2, h: 1 },
            { id: mainIds[4], x: 11, y: 2, w: 2, h: 1 }
          ]
        }
        break
      case 6:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 8, h: 3 },

            //
            { id: mainIds[1], x: 9, y: 1, w: 2, h: 1 },
            { id: mainIds[2], x: 11, y: 1, w: 2, h: 1 },
            //
            { id: mainIds[5], x: 9, y: 2, w: 4, h: 1 },
            //
            { id: mainIds[3], x: 9, y: 3, w: 2, h: 1 },
            { id: mainIds[4], x: 11, y: 3, w: 2, h: 1 }
          ]
        }
        break
      case 7:
        {
          layout.cols = 12
          layout.rows = 3
          layout.items = [
            //
            { id: mainIds[0], x: 3, y: 1, w: 8, h: 3 },
            //
            { id: mainIds[1], x: 1, y: 1, w: 2, h: 1 },
            { id: mainIds[2], x: 1, y: 2, w: 2, h: 1 },
            { id: mainIds[3], x: 1, y: 3, w: 2, h: 1 },
            //
            { id: mainIds[4], x: 11, y: 1, w: 2, h: 1 },
            { id: mainIds[5], x: 11, y: 2, w: 2, h: 1 },
            { id: mainIds[6], x: 11, y: 3, w: 2, h: 1 }
          ]
        }
        break
      case 8:
        {
          layout.cols = 12
          layout.rows = 12
          layout.items = [
            //
            { id: mainIds[0], x: 4, y: 1, w: 7, h: 12 },
            //
            { id: mainIds[1], x: 1, y: 1, w: 3, h: 4 },
            { id: mainIds[2], x: 1, y: 5, w: 3, h: 4 },
            { id: mainIds[3], x: 1, y: 9, w: 3, h: 4 },
            //
            { id: mainIds[4], x: 11, y: 1, w: 2, h: 3 },
            { id: mainIds[5], x: 11, y: 4, w: 2, h: 3 },
            { id: mainIds[6], x: 11, y: 7, w: 2, h: 3 },
            { id: mainIds[7], x: 11, y: 10, w: 2, h: 3 }
          ]
        }
        break
      case 9:
        {
          layout.cols = 12
          layout.rows = 4
          layout.items = [
            //
            { id: mainIds[0], x: 3, y: 1, w: 8, h: 4 },
            //
            { id: mainIds[1], x: 1, y: 1, w: 2, h: 1 },
            { id: mainIds[2], x: 1, y: 2, w: 2, h: 1 },
            { id: mainIds[3], x: 1, y: 3, w: 2, h: 1 },
            { id: mainIds[4], x: 1, y: 4, w: 2, h: 1 },
            //
            { id: mainIds[5], x: 11, y: 1, w: 2, h: 1 },
            { id: mainIds[6], x: 11, y: 2, w: 2, h: 1 },
            { id: mainIds[7], x: 11, y: 3, w: 2, h: 1 },
            { id: mainIds[8], x: 11, y: 4, w: 2, h: 1 }
          ]
        }
        break
      case 10:
        {
          layout.cols = 15
          layout.rows = 11
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 11, h: 11 },
            //
            { id: mainIds[1], x: 12, y: 5, w: 4, h: 3 },
            //
            { id: mainIds[2], x: 12, y: 1, w: 2, h: 2 },
            { id: mainIds[3], x: 14, y: 1, w: 2, h: 2 },
            //
            { id: mainIds[4], x: 12, y: 3, w: 2, h: 2 },
            { id: mainIds[5], x: 14, y: 3, w: 2, h: 2 },
            //
            { id: mainIds[6], x: 12, y: 8, w: 2, h: 2 },
            { id: mainIds[7], x: 14, y: 8, w: 2, h: 2 },
            //
            { id: mainIds[8], x: 12, y: 10, w: 2, h: 2 },
            { id: mainIds[9], x: 14, y: 10, w: 2, h: 2 }
          ]
        }
        break
      case 11:
        {
          layout.cols = 15
          layout.rows = 5
          layout.items = [
            //
            { id: mainIds[0], x: 1, y: 1, w: 11, h: 5 },
            //
            { id: mainIds[1], x: 12, y: 1, w: 2, h: 1 },
            { id: mainIds[2], x: 14, y: 1, w: 2, h: 1 },
            //
            { id: mainIds[3], x: 12, y: 2, w: 2, h: 1 },
            { id: mainIds[4], x: 14, y: 2, w: 2, h: 1 },
            //
            { id: mainIds[5], x: 12, y: 3, w: 2, h: 1 },
            { id: mainIds[6], x: 14, y: 3, w: 2, h: 1 },
            //
            { id: mainIds[7], x: 12, y: 4, w: 2, h: 1 },
            { id: mainIds[8], x: 14, y: 4, w: 2, h: 1 },
            //
            { id: mainIds[9], x: 12, y: 5, w: 2, h: 1 },
            { id: mainIds[10], x: 14, y: 5, w: 2, h: 1 }
          ]
        }
        break
    }
  }

  createMain(mainIds)

  const createSurplus = (surplusIds: string[]) => {
    if (surplusIds.length === 0) return

    let x = 12
    let y = ROWS + 1

    while (true) {
      if (surplusIds.length === 0) break
      if (x === 16) {
        x = 12
        y++
      }
      const id = surplusIds.shift()
      if (!id) break
      let w = 2
      if (surplusIds.length === 0) {
        w = 4
        x = 12
      }
      const item = { id, x, y, w, h: 1 }
      layout.items.push(item)
      x += 2
    }
  }

  createSurplus(surplusIds)

  return layout
}

// 生成布局
export const getLayout = (mode: '1' | '2', ids: string[]): Layout => {
  if (mode === '1') return getLayoutModel1(ids)
  else if (mode === '2') return getLayoutModel2(ids)
  return { gap: 0, cols: 1, rows: 1, items: [] }
}
