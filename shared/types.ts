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
//   'claude'       — open a Claude terminal session in the repo (default).
//   'run'          — pick a folder and run a bundled script against it.
//   'scaffold'     — clone an external repo, pick a branch, open Claude with a seeded prompt.
//   'transcribe'   — in-card voice recorder that transcribes via Whisper and copies to clipboard.
//   'reading-list' — in-card controls to import from Reminders or paste a URL; stored in SQLite.
//   'calendar'     — modal with text, voice, and screenshot inputs that generates and runs AppleScript.
//   'loan'         — structured form modal that generates a Norwegian loan agreement PDF.
//   'bookkeeping'  — drag-and-drop bank statements → Claude extracts transactions → creates voucher folders.
export type WorkflowAction =
  | "claude"
  | "run"
  | "scaffold"
  | "transcribe"
  | "reading-list"
  | "calendar"
  | "loan"
  | "loan-interest"
  | "bookkeeping";

export interface LoanStakeholder {
  name: string;
  account: string;
  type: "person" | "company";
  allowedBorrowers?: string[];
}

export interface LoanFormData {
  givingStakeholder: string;
  receivingStakeholder: string;
  amount: number;
  date: string;
  location: string;
}

export interface LoanStakeholdersResult {
  success: boolean;
  lenders?: LoanStakeholder[];
  borrowers?: LoanStakeholder[];
  error?: string;
}

export interface LoanGenerateResult {
  success: boolean;
  error?: string;
}

// Configuration for the 'bookkeeping' action type.
export interface BookkeepingConfig {
  // Default folder where voucher sub-folders are created. Can be overridden per-run.
  default_output_dir: string;
}

// Configuration for the 'scaffold' action type.
export interface ScaffoldConfig {
  // Local path or remote URL of the repo to clone/pull.
  repo: string;
  // Branch to pre-select in the picker. Falls back to the repo default.
  branch_default?: string;
  // CLI command shown in the modal (informational) and embedded in the initial prompt.
  command: string;
  // Template for Claude's initial prompt. Use {description} as the placeholder.
  initial_prompt_template: string;
  // Shell command run once after first clone (and re-run when this string changes).
  // Executed via `bash -c` in the cache directory. Typical use: venv creation and
  // dependency installation, e.g. "python3 -m venv .venv && .venv/bin/pip install -e ."
  setup_command?: string;
}

// Result of listing branches for a scaffold repo.
export interface BranchListResult {
  success: boolean;
  branches: string[];
  error?: string;
}

export interface TranscriptionEntry {
  id: string;
  text: string;
  // ISO timestamp of when the transcription was saved
  timestamp: string;
}

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
  scaffold?: ScaffoldConfig;
  bookkeeping?: BookkeepingConfig;
  // When true on a 'claude'-action workflow, an inline voice recorder is shown
  // alongside the Open button. After transcription the text is automatically
  // passed as the initial prompt when opening Claude.
  transcribe_to_claude?: boolean;
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

// A single activity log entry written to workflow-hub-data/activity-log/.
export interface ReadingListEntry {
  id: string;
  url: string;
  title: string;
  notes: string;
  source: string;
  added_at: string | null;
  status: "unread" | "read" | "skipped";
}

export interface ReadingListImportResult {
  success: boolean;
  imported?: number;
  duplicates?: number;
  error?: string;
}

export interface ReadingListAddResult {
  success: boolean;
  id?: string;
  error?: string;
}

export interface VoucherFolderResult {
  success: boolean;
  output: string;
  folders: string[];
  error?: string;
}

export interface LoanTransaction {
  id: string;
  lender: string;
  borrower: string;
  date: string;
  type: "loan" | "repayment";
  amount: number;
}

export interface LoanTransactionsResult {
  success: boolean;
  transactions?: LoanTransaction[];
  error?: string;
}

export interface LoanTransactionSaveResult {
  success: boolean;
  transaction?: LoanTransaction;
  error?: string;
}

export interface LoanTransactionDeleteResult {
  success: boolean;
  error?: string;
}

export interface LoanInterestPeriod {
  label: string;
  rate: number;
  balance: number;
  days: number;
  interest: number;
}

export interface LoanInterestResult {
  success: boolean;
  periods?: LoanInterestPeriod[];
  totalInterest?: number;
  error?: string;
}

export interface ActivityEntry {
  timestamp: string;
  workflow_id: string;
  workflow_name: string;
  action: string;
  branch?: string;
  description?: string;
  success: boolean;
  error?: string;
}
