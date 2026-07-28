#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/appfront"
RELEASE_DIR="$FRONTEND_DIR/release"

print_header() {
  printf '\n%s\n' "$1"
}

require_command() {
  local command_name="$1"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name"
    exit 1
  fi
}

print_header "NovaPOS update"

require_command node
require_command npm

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "Frontend directory not found: $FRONTEND_DIR"
  exit 1
fi

print_header "Refreshing frontend dependencies"
(
  cd "$FRONTEND_DIR"
  npm install
)

print_header "Packaging latest macOS desktop build"
(
  cd "$FRONTEND_DIR"
  npm run desktop:package:mac
)

print_header "Update complete"
echo "Latest macOS artifacts:"
ls -lh "$RELEASE_DIR"/NovaPOS-*.dmg "$RELEASE_DIR"/NovaPOS-*-mac.zip
