export type WorkflowStatus = "active" | "inactive" | "error" | "draft";
export type TriggerType = "manual" | "scheduled" | "webhook" | "event";
export type RunStatus = "success" | "failure" | "partial" | "cancelled";
export type Complexity = "simple" | "moderate" | "complex";

export interface WorkflowInput {
  name: string;
  type: "string" | "number" | "boolean" | "file" | "date";
  description: string;
  required: boolean;
  example?: string;
}

export interface WorkflowOutput {
  name: string;
  type: "file" | "json" | "text" | "email" | "pdf";
  description: string;
}

// How the primary action button behaves:
//   'claude' — open a Claude terminal session in the repo (default).
//   'run'    — pick a folder and run a bundled script against it.
export type WorkflowAction = "claude" | "run";

// A user-adjustable option surfaced in the run modal and passed to the script
// as a CLI flag. Currently numeric only.
export interface WorkflowRunnerOption {
  key: string;
  // Control label, e.g. "Only move files older than".
  label: string;
  // CLI flag the value is passed with, e.g. "--min-age-days".
  flag: string;
  type: "number";
  // Value used when the option is enabled.
  default: number;
  // Unit suffix shown after the input, e.g. "days".
  unit?: string;
  min?: number;
  max?: number;
  // When true the option is off by default and gets an on/off toggle; the flag
  // is only passed when the user enables it.
  optional?: boolean;
}

// A launchd-backed scheduled run of the workflow's script. Display metadata
// lives here; the actual install/load is done by the workflow's schedule.sh.
export interface ScheduledJob {
  // launchd label, e.g. as.decide.workflow-hub.file-organizer.
  label: string;
  // Folder the job operates on (~ is expanded). Shown in the UI.
  target: string;
  // Human cadence shown in the UI, e.g. "Every hour".
  cadence: string;
  // Seconds between runs (StartInterval).
  interval_seconds?: number;
  // Only act on files older than this many days (0 = all).
  min_age_days?: number;
}

// Live state of a scheduled job, reported by schedule.sh status.
export interface ScheduleStatus {
  installed: boolean;
  loaded: boolean;
  lastRunAt?: string | null;
  lastExitCode?: number | null;
  logPath?: string | null;
  error?: string;
}

export interface WorkflowRunner {
  // Script to execute, relative to the workflow's repo_path.
  script: string;
  // Interpreter binary. Defaults to python3.
  interpreter?: string;
  // Title for the folder-picker dialog.
  pick_prompt?: string;
  // When true, a first dry-run produces a preview the user confirms before the
  // real run. The script receives no apply flag for the preview and
  // `apply_flag` for the real run.
  preview?: boolean;
  // CLI flag appended to switch the script from preview to a real run.
  apply_flag?: string;
  // Adjustable options shown in the run modal.
  options?: WorkflowRunnerOption[];
}

export interface Workflow {
  id: string;
  name: string;
  // Full description — shown in the workflow modal.
  description: string;
  // Short one-line summary for the card. Falls back to description if unset.
  summary?: string;
  tags: string[];
  // Path to the workflow repo, used to launch a Claude terminal session. May be
  // absolute, or relative to the app root (resolved at open time).
  repo_path: string;
  color: string;
  icon: string;
  cluster_id: string | null;
  added: string;
  updated: string;

  // Operational
  status?: WorkflowStatus;
  trigger_type?: TriggerType;
  schedule?: string | null;

  // Run history
  last_run_at?: string | null;
  last_run_status?: RunStatus | null;
  run_count?: number;
  success_rate?: number | null;

  // Performance & cost
  estimated_duration_seconds?: number | null;
  estimated_cost_usd?: number | null;
  model?: string;

  // Definition
  version?: string;
  complexity?: Complexity;
  owner?: string | null;
  inputs?: WorkflowInput[];
  outputs?: WorkflowOutput[];

  // Action — how the primary button behaves. Defaults to 'claude'.
  action?: WorkflowAction;
  runner?: WorkflowRunner;
  // Present when the workflow can be installed as a recurring launchd job.
  scheduled_job?: ScheduledJob;
}

export interface Cluster {
  id: string;
  name: string;
  tags: string[];
  workflow_ids: string[];
}

export interface Registry {
  workflows: Workflow[];
  clusters: Cluster[];
}

export type OpenErrorKind =
  | "permission"
  | "claude-missing"
  | "path-missing"
  | "unknown";

export interface OpenResult {
  success: boolean;
  error?: string;
  errorKind?: OpenErrorKind;
}

export type RunErrorKind =
  | "not-runnable"
  | "interpreter-missing"
  | "script-missing"
  | "folder-missing"
  | "unknown";

export interface RunResult {
  success: boolean;
  // Combined stdout + stderr from the script — shown verbatim to the user.
  output: string;
  error?: string;
  errorKind?: RunErrorKind;
}
