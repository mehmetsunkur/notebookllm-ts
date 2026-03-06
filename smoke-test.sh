#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

CLI=(bun run src/cli/index.ts --verbose)

ENV_FILE="${ENV_FILE:-.env}"
RUN_PUBLIC_TEST="${RUN_PUBLIC_TEST:-false}"
KEEP_ARTIFACTS="${KEEP_ARTIFACTS:-false}"
ARTIFACT_TIMEOUT="${ARTIFACT_TIMEOUT:-900}"   # seconds to wait for any artifact to be ready

print_header() {
  printf '\n== %s ==\n' "$1"
}

run_cmd() {
  printf '\n$ %s\n' "$*"
  "$@"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

load_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing env file: $ENV_FILE" >&2
    echo "Create it with NOTEBOOK_ID and TEST_EMAIL." >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  : "${NOTEBOOK_ID:?NOTEBOOK_ID is required in $ENV_FILE}"
  : "${TEST_EMAIL:?TEST_EMAIL is required in $ENV_FILE}"
}

run_regression_guard() {
  print_header "Regression Guard"
  run_cmd "${CLI[@]}" list --json || true
  run_cmd "${CLI[@]}" summary -n "$NOTEBOOK_ID" --json || true
  run_cmd "${CLI[@]}" ask -n "$NOTEBOOK_ID" "quick rpc smoke question" --json || true
}

on_error() {
  local exit_code=$?
  echo "\nSmoke test failed (exit code: $exit_code). Running regression guard..." >&2
  run_regression_guard
  exit "$exit_code"
}
trap on_error ERR

# Print task IDs returned by fire-and-forget generate commands.
print_task_ids() {
  local label="$1"
  shift
  printf '\nStarted %s:\n' "$label"
  for json in "$@"; do
    bun -e '
const r = JSON.parse(process.argv[1]);
const id = r.taskId || r.id || "(no id)";
const st = r.status || "?";
console.log("  " + id + "  [" + st + "]");
' "$json" 2>/dev/null || true
  done
}

pick_artifact_id() {
  local before_json="$1"
  local after_json="$2"

  bun -e '
const before = JSON.parse(process.argv[1]);
const after = JSON.parse(process.argv[2]);
const beforeIds = new Set(before.map((a) => a.id));
const preferredTypes = new Set([
  "audio", "video", "report", "quiz", "flashcards", "infographic", "slide_deck", "data_table", "mind_map"
]);
const newlyCreated = after.filter((a) => !beforeIds.has(a.id));
const readyNew = newlyCreated.find((a) => a.status === "ready" && preferredTypes.has(a.type));
if (readyNew?.id) {
  console.log(readyNew.id);
  process.exit(0);
}
const anyReady = after.find((a) => a.status === "ready");
if (anyReady?.id) {
  console.log(anyReady.id);
  process.exit(0);
}
process.exit(1);
' "$before_json" "$after_json"
}

# Poll artifact list with exponential backoff until at least one newly created
# artifact is ready (mirrors Python's wait_for_completion approach).
wait_for_ready_artifact() {
  local before_json="$1"
  local notebook_id="$2"
  local timeout_secs="${ARTIFACT_TIMEOUT}"
  local interval=5
  local max_interval=30
  local deadline=$(( $(date +%s) + timeout_secs ))
  local attempt=0

  printf '\nWaiting for artifacts to be ready (timeout: %ds, backoff: %d..%ds)...\n' \
    "$timeout_secs" "$interval" "$max_interval"

  while true; do
    local now
    now=$(date +%s)
    if (( now >= deadline )); then
      echo "Timeout: no artifact became ready within ${timeout_secs}s." >&2
      return 1
    fi

    local after_json
    after_json="$("${CLI[@]}" artifact list -n "$notebook_id" --json 2>/dev/null)"

    if pick_artifact_id "$before_json" "$after_json" > /dev/null 2>&1; then
      printf 'Ready artifact found after %ds.\n' "$(( $(date +%s) - deadline + timeout_secs ))"
      echo "$after_json"
      return 0
    fi

    # Show counts while waiting
    bun -e '
const before = JSON.parse(process.argv[1]);
const after  = JSON.parse(process.argv[2]);
const beforeIds = new Set(before.map((a) => a.id));
const newOnes = after.filter((a) => !beforeIds.has(a.id));
const byStatus = {};
for (const a of newOnes) byStatus[a.status] = (byStatus[a.status] || 0) + 1;
const parts = Object.entries(byStatus).map(([s,n]) => n + " " + s);
console.log("  " + (parts.length ? parts.join(", ") : "none yet"));
' "$before_json" "$after_json" 2>/dev/null || true

    attempt=$(( attempt + 1 ))
    # Exponential backoff: double interval up to max_interval
    interval=$(( interval * 2 > max_interval ? max_interval : interval * 2 ))
    printf 'Sleeping %ds before next poll...\n' "$interval"
    sleep "$interval"
  done
}

main() {
  require_cmd bun
  load_env

  print_header "Environment"
  echo "ENV_FILE=$ENV_FILE"
  echo "NOTEBOOK_ID=$NOTEBOOK_ID"
  echo "TEST_EMAIL=$TEST_EMAIL"
  echo "RUN_PUBLIC_TEST=$RUN_PUBLIC_TEST"
  echo "KEEP_ARTIFACTS=$KEEP_ARTIFACTS"
  echo "ARTIFACT_TIMEOUT=${ARTIFACT_TIMEOUT}s"

  print_header "Preflight"
  run_cmd bun run typecheck
  run_cmd bun test
  run_cmd "${CLI[@]}" auth check --test --json
  run_cmd "${CLI[@]}" summary -n "$NOTEBOOK_ID" --json
  run_cmd "${CLI[@]}" share status -n "$NOTEBOOK_ID" --json

  print_header "Phase A: Fire-and-forget generation (Python style)"
  before_artifacts="$("${CLI[@]}" artifact list -n "$NOTEBOOK_ID" --json)"

  r_audio="$("${CLI[@]}"    generate audio      -n "$NOTEBOOK_ID" --json)"
  r_video="$("${CLI[@]}"    generate video      -n "$NOTEBOOK_ID" --json)"
  r_report="$("${CLI[@]}"   generate report     -n "$NOTEBOOK_ID" --json)"
  r_quiz="$("${CLI[@]}"     generate quiz       -n "$NOTEBOOK_ID" --json)"
  r_flash="$("${CLI[@]}"    generate flashcards -n "$NOTEBOOK_ID" --json)"
  r_info="$("${CLI[@]}"     generate infographic -n "$NOTEBOOK_ID" --json)"
  r_slide="$("${CLI[@]}"    generate slide-deck -n "$NOTEBOOK_ID" --json)"
  r_table="$("${CLI[@]}"    generate data-table  -n "$NOTEBOOK_ID" "Test table" --json)"
  r_mmap="$("${CLI[@]}"     generate mind-map   -n "$NOTEBOOK_ID" --json)"

  print_task_ids "all generates" \
    "$r_audio" "$r_video" "$r_report" "$r_quiz" "$r_flash" \
    "$r_info" "$r_slide" "$r_table" "$r_mmap"

  # Wait for at least one artifact to be ready before artifact operations
  after_artifacts="$(wait_for_ready_artifact "$before_artifacts" "$NOTEBOOK_ID")"
  echo "$after_artifacts"

  artifact_id="$(pick_artifact_id "$before_artifacts" "$after_artifacts")"
  print_header "Selected Artifact"
  echo "ARTIFACT_ID=$artifact_id"

  run_cmd "${CLI[@]}" artifact rename "$artifact_id" "rpc-smoke-renamed" -n "$NOTEBOOK_ID" --json
  run_cmd "${CLI[@]}" artifact export "$artifact_id" -n "$NOTEBOOK_ID" --type docs --title "rpc-smoke-export" --json

  if [[ "$KEEP_ARTIFACTS" != "true" ]]; then
    run_cmd "${CLI[@]}" artifact delete "$artifact_id" -n "$NOTEBOOK_ID" -y
  else
    echo "Skipping artifact delete because KEEP_ARTIFACTS=true"
  fi

  print_header "Phase B: Sharing Mutation Deep Smoke"
  run_cmd "${CLI[@]}" share status -n "$NOTEBOOK_ID" --json
  run_cmd "${CLI[@]}" share add "$TEST_EMAIL" -n "$NOTEBOOK_ID" --permission viewer --json
  run_cmd "${CLI[@]}" share update "$TEST_EMAIL" -n "$NOTEBOOK_ID" --permission editor --json
  run_cmd "${CLI[@]}" share remove "$TEST_EMAIL" -n "$NOTEBOOK_ID" -y
  run_cmd "${CLI[@]}" share view-level view -n "$NOTEBOOK_ID" --json

  if [[ "$RUN_PUBLIC_TEST" == "true" ]]; then
    run_cmd "${CLI[@]}" share public -n "$NOTEBOOK_ID" --enable --json
    run_cmd "${CLI[@]}" share public -n "$NOTEBOOK_ID" --disable --json
  else
    echo "Skipping public share toggle (RUN_PUBLIC_TEST=$RUN_PUBLIC_TEST)"
  fi

  run_regression_guard

  print_header "Done"
  echo "RPC deep smoke completed successfully."
}

main "$@"
