export type WorkflowStatus = 'active' | 'inactive' | 'error' | 'draft'
export type TriggerType = 'manual' | 'scheduled' | 'webhook' | 'event'
export type RunStatus = 'success' | 'failure' | 'partial' | 'cancelled'
export type Complexity = 'simple' | 'moderate' | 'complex'

export interface WorkflowInput {
  name: string
  type: 'string' | 'number' | 'boolean' | 'file' | 'date'
  description: string
  required: boolean
  example?: string
}

export interface WorkflowOutput {
  name: string
  type: 'file' | 'json' | 'text' | 'email' | 'pdf'
  description: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  tags: string[]
  // Path to the workflow repo, used to launch a Claude terminal session. May be
  // absolute, or relative to the app root (resolved at open time).
  repo_path: string
  color: string
  icon: string
  cluster_id: string | null
  added: string
  updated: string

  // Operational
  status?: WorkflowStatus
  trigger_type?: TriggerType
  schedule?: string | null

  // Run history
  last_run_at?: string | null
  last_run_status?: RunStatus | null
  run_count?: number
  success_rate?: number | null

  // Performance & cost
  estimated_duration_seconds?: number | null
  estimated_cost_usd?: number | null
  model?: string

  // Definition
  version?: string
  complexity?: Complexity
  owner?: string | null
  inputs?: WorkflowInput[]
  outputs?: WorkflowOutput[]
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

export type OpenErrorKind = 'permission' | 'claude-missing' | 'path-missing' | 'unknown'

export interface OpenResult {
  success: boolean
  error?: string
  errorKind?: OpenErrorKind
}
