/** 指针坐标 → 内容区本地坐标（与容器是否滚动无关） */
export const clientToContentPoint = (
  contentEl: HTMLElement,
  clientX: number,
  clientY: number
): { x: number; y: number } => {
  const rect = contentEl.getBoundingClientRect()
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  }
}
