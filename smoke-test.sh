#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

CLI=(bun run src/cli/index.ts --verbose)

ENV_FILE="${ENV_FILE:-.env}"
RUN_PUBLIC_TEST="${RUN_PUBLIC_TEST:-false}"
KEEP_ARTIFACTS="${KEEP_ARTIFACTS:-false}"

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

main() {
  require_cmd bun
  load_env

  print_header "Environment"
  echo "ENV_FILE=$ENV_FILE"
  echo "NOTEBOOK_ID=$NOTEBOOK_ID"
  echo "TEST_EMAIL=$TEST_EMAIL"
  echo "RUN_PUBLIC_TEST=$RUN_PUBLIC_TEST"
  echo "KEEP_ARTIFACTS=$KEEP_ARTIFACTS"

  print_header "Preflight"
  run_cmd bun run typecheck
  run_cmd bun test
  run_cmd "${CLI[@]}" auth check --test --json
  run_cmd "${CLI[@]}" summary -n "$NOTEBOOK_ID" --json
  run_cmd "${CLI[@]}" share status -n "$NOTEBOOK_ID" --json

  print_header "Phase A: Artifact Deep Smoke"
  before_artifacts="$("${CLI[@]}" artifact list -n "$NOTEBOOK_ID" --json)"

  run_cmd "${CLI[@]}" generate audio -n "$NOTEBOOK_ID" --wait --json
  run_cmd "${CLI[@]}" generate video -n "$NOTEBOOK_ID" --wait --json
  run_cmd "${CLI[@]}" generate report -n "$NOTEBOOK_ID" --wait --json
  run_cmd "${CLI[@]}" generate quiz -n "$NOTEBOOK_ID" --wait --json
  run_cmd "${CLI[@]}" generate flashcards -n "$NOTEBOOK_ID" --wait --json
  run_cmd "${CLI[@]}" generate infographic -n "$NOTEBOOK_ID" --wait --json
  run_cmd "${CLI[@]}" generate slide-deck -n "$NOTEBOOK_ID" --wait --json
  run_cmd "${CLI[@]}" generate data-table -n "$NOTEBOOK_ID" "Test table" --wait --json
  run_cmd "${CLI[@]}" generate mind-map -n "$NOTEBOOK_ID" --wait --json

  after_artifacts="$("${CLI[@]}" artifact list -n "$NOTEBOOK_ID" --json)"
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
