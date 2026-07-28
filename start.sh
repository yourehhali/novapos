#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/api"
FRONTEND_DIR="$ROOT_DIR/appfront"
RUN_DIR="$ROOT_DIR/.run"

API_PID_FILE="$RUN_DIR/api.pid"
FRONTEND_PID_FILE="$RUN_DIR/appfront.pid"
API_LOG_FILE="$RUN_DIR/api.log"
FRONTEND_LOG_FILE="$RUN_DIR/appfront.log"

mkdir -p "$RUN_DIR"

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

java_major_version() {
  java -version 2>&1 | awk -F[\".] '/version/ {print ($2 == "1" ? $3 : $2); exit}'
}

find_compatible_java_home() {
  /usr/libexec/java_home -v 21+ 2>/dev/null || true
}

port_in_use() {
  local port="$1"
  lsof -iTCP:"$port" -sTCP:LISTEN -t >/dev/null 2>&1
}

pid_is_running() {
  local pid_file="$1"

  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"

    if kill -0 "$pid" >/dev/null 2>&1; then
      return 0
    fi
  fi

  return 1
}

cleanup_stale_pid() {
  local pid_file="$1"

  if [[ -f "$pid_file" ]] && ! pid_is_running "$pid_file"; then
    rm -f "$pid_file"
  fi
}

start_background_process() {
  local name="$1"
  local cwd="$2"
  local command="$3"
  local pid_file="$4"
  local log_file="$5"
  local port="$6"

  cleanup_stale_pid "$pid_file"

  if pid_is_running "$pid_file"; then
    echo "$name is already running with PID $(cat "$pid_file")."
    return 0
  fi

  if port_in_use "$port"; then
    echo "$name port $port is already in use. Skipping startup."
    return 0
  fi

  echo "Starting $name..."
  (
    cd "$cwd"
    nohup bash -lc "$command" >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )

  sleep 3

  if pid_is_running "$pid_file"; then
    echo "$name started successfully on port $port."
  else
    echo "$name failed to start. Last log lines:"
    tail -n 40 "$log_file" || true
    exit 1
  fi
}

print_header "NovaPOS startup"

require_command java
require_command node
require_command npm
require_command lsof

JAVA_MAJOR="$(java_major_version)"

if [[ "$JAVA_MAJOR" -lt 21 ]]; then
  COMPATIBLE_JAVA_HOME="$(find_compatible_java_home)"

  if [[ -n "$COMPATIBLE_JAVA_HOME" ]]; then
    export JAVA_HOME="$COMPATIBLE_JAVA_HOME"
    export PATH="$JAVA_HOME/bin:$PATH"
    JAVA_MAJOR="$(java_major_version)"
    echo "Detected Java $JAVA_MAJOR at $JAVA_HOME and using it for startup."
  else
    echo "Java 21 is required for the backend. Current detected version: $JAVA_MAJOR"
    echo "No compatible JDK >= 21 was found via /usr/libexec/java_home."
    echo "Please install or switch to Java 21+, then run ./start.sh again."
    exit 1
  fi
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  print_header "Installing frontend dependencies"
  (
    cd "$FRONTEND_DIR"
    npm install
  )
fi

start_background_process "Backend API" "$API_DIR" "./mvnw spring-boot:run" "$API_PID_FILE" "$API_LOG_FILE" "8080"
start_background_process "Frontend app" "$FRONTEND_DIR" "npm start -- --host 0.0.0.0" "$FRONTEND_PID_FILE" "$FRONTEND_LOG_FILE" "4200"

print_header "NovaPOS is starting"
echo "Frontend: http://localhost:4200"
echo "Backend:  http://localhost:8080"
echo "Backend log:  $API_LOG_FILE"
echo "Frontend log: $FRONTEND_LOG_FILE"
echo
echo "If you need to stop the processes manually:"
echo "kill \$(cat \"$API_PID_FILE\") \$(cat \"$FRONTEND_PID_FILE\")"
