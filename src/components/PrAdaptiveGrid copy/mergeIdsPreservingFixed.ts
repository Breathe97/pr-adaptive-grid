/**
 * 合并 ids 时保持 fixed item 在 previousIds 中的槽位不变，
 * 其余位置按 candidateIds 中可移动 id 的出现顺序依次填入。
 */
export const mergeIdsPreservingFixed = (
  previousIds: string[],
  candidateIds: string[],
  fixedIds: ReadonlySet<string> | readonly string[]
): string[] => {
  const n = candidateIds.length
  if (n === 0) return []

  const fixedSet = fixedIds instanceof Set ? fixedIds : new Set(fixedIds)
  if (fixedSet.size === 0) return [...candidateIds]

  const result: string[] = new Array(n)

  for (let i = 0; i < n; i++) {
    if (i < previousIds.length && fixedSet.has(previousIds[i])) {
      result[i] = previousIds[i]
    }
  }

  const movableQueue = candidateIds.filter((id) => !fixedSet.has(id))
  let cursor = 0
  for (let i = 0; i < n; i++) {
    if (result[i] == null) {
      result[i] = movableQueue[cursor++]
    }
  }

  return result
}
