export interface Workflow {
  id: string
  name: string
  description: string
  tags: string[]
  repo_path: string
  color: string
  icon: string
  cluster_id: string | null
  added: string
  updated: string
}

export interface Cluster {
  id: string
  name: string
  tags: string[]
  workflow_ids: string[]
}

export interface Registry {
  workflows: Workflow[]
  clusters: Cluster[]
}

export interface OpenResult {
  success: boolean
  error?: string
}
