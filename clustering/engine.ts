import type { Workflow, Cluster } from '../shared/types'
import { v4 as uuidv4 } from 'uuid'

export function cluster(workflows: Workflow[]): { workflows: Workflow[]; clusters: Cluster[] } {
  if (workflows.length === 0) return { workflows: [], clusters: [] }

  // Build tag → workflow_ids index
  const tagIndex = new Map<string, string[]>()
  for (const w of workflows) {
    for (const tag of w.tags) {
      const t = tag.toLowerCase()
      if (!tagIndex.has(t)) tagIndex.set(t, [])
      tagIndex.get(t)!.push(w.id)
    }
  }

  // Union-Find
  const parent = new Map<string, string>(workflows.map((w) => [w.id, w.id]))

  function find(x: string): string {
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)!))
    return parent.get(x)!
  }

  function union(a: string, b: string): void {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }

  for (const ids of tagIndex.values()) {
    for (let i = 1; i < ids.length; i++) union(ids[0], ids[i])
  }

  // Group by root
  const components = new Map<string, string[]>()
  for (const w of workflows) {
    const root = find(w.id)
    if (!components.has(root)) components.set(root, [])
    components.get(root)!.push(w.id)
  }

  // Build clusters for components with 2+ members
  const clusterMap = new Map<string, string>() // workflow_id → cluster_id
  const clusters: Cluster[] = []

  for (const [root, ids] of components.entries()) {
    if (ids.length < 2) continue

    const clusterWorkflows = workflows.filter((w) => ids.includes(w.id))
    const tagFreq = new Map<string, number>()
    for (const w of clusterWorkflows) {
      for (const tag of w.tags) {
        const t = tag.toLowerCase()
        tagFreq.set(t, (tagFreq.get(t) ?? 0) + 1)
      }
    }

    // Cluster name = most frequent shared tag (appears in 2+ workflows)
    let bestTag = ''
    let bestCount = 0
    for (const [tag, count] of tagFreq.entries()) {
      if (count > bestCount || (count === bestCount && tag < bestTag)) {
        bestTag = tag
        bestCount = count
      }
    }

    const clusterId = root === ids[0] ? uuidv4() : root
    const c: Cluster = {
      id: clusterId,
      name: bestTag || 'group',
      tags: [...tagFreq.keys()],
      workflow_ids: ids,
    }
    clusters.push(c)
    for (const id of ids) clusterMap.set(id, clusterId)
  }

  const updated = workflows.map((w) => ({
    ...w,
    cluster_id: clusterMap.get(w.id) ?? null,
  }))

  return { workflows: updated, clusters }
}
