#!/usr/bin/env bash
# Read-only inventory helper for the already-deployed Ocean server.
# Run on the server. Do not paste private IPs, key paths, tokens, or incident notes into Git.

set -euo pipefail

APP_DIR="${APP_DIR:-/opt/ocean}"
DATA_DIR="${DATA_DIR:-/srv/ocean/data}"
SERVICE_NAME="${SERVICE_NAME:-ocean-api}"

section() {
  printf '\n## %s\n' "$1"
}

kv() {
  printf '%-28s %s\n' "$1:" "$2"
}

section "Host"
kv "hostname" "$(hostname)"
kv "kernel" "$(uname -srmo)"
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  kv "os" "${PRETTY_NAME:-unknown}"
fi
kv "time_utc" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

section "CPU And Memory"
kv "cpu_model" "$(awk -F: '/model name/ {gsub(/^ /, "", $2); print $2; exit}' /proc/cpuinfo 2>/dev/null || echo unknown)"
kv "cpu_cores" "$(nproc 2>/dev/null || echo unknown)"
free -h || true

section "Disk"
df -h / /opt /srv 2>/dev/null || df -h
if [ -d "$DATA_DIR" ]; then
  du -sh "$DATA_DIR" "$DATA_DIR"/raw "$DATA_DIR"/processed "$DATA_DIR"/cache "$DATA_DIR"/outputs 2>/dev/null || true
else
  kv "data_dir" "missing: $DATA_DIR"
fi

section "Application Paths"
kv "app_dir" "$APP_DIR"
kv "data_dir" "$DATA_DIR"
kv "env_dir" "/etc/ocean"
find "$APP_DIR" -maxdepth 2 -type d 2>/dev/null | sort | head -n 40 || true

section "Sync And Access Model"
kv "current_user" "$(id -un 2>/dev/null || echo unknown)"
kv "current_uid" "$(id -u 2>/dev/null || echo unknown)"
if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  kv "sudo_without_prompt" "yes"
elif command -v sudo >/dev/null 2>&1; then
  kv "sudo_without_prompt" "no_or_requires_prompt"
else
  kv "sudo_without_prompt" "unavailable"
fi
if id ocean >/dev/null 2>&1; then
  kv "service_user" "ocean"
else
  kv "service_user" "missing"
fi
kv "app_dir_owner" "$(stat -c '%U:%G' "$APP_DIR" 2>/dev/null || echo missing)"
kv "data_dir_owner" "$(stat -c '%U:%G' "$DATA_DIR" 2>/dev/null || echo missing)"
kv "env_dir_owner" "$(stat -c '%U:%G' /etc/ocean 2>/dev/null || echo missing)"
if [ -n "${SSH_AUTH_SOCK:-}" ]; then
  kv "ssh_agent" "present"
else
  kv "ssh_agent" "absent"
fi
kv "deploy_model" "code:/opt/ocean data:/srv/ocean/data env:/etc/ocean service-user:ocean"

section "Git Revision"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" rev-parse --abbrev-ref HEAD || true
  git -C "$APP_DIR" rev-parse --short HEAD || true
else
  kv "git" "not a checkout or .git is absent"
fi

section "Systemd"
systemctl is-enabled "$SERVICE_NAME" 2>/dev/null || true
systemctl is-active "$SERVICE_NAME" 2>/dev/null || true
systemctl --no-pager --full status "$SERVICE_NAME" 2>/dev/null | sed -n '1,18p' || true

section "Nginx"
nginx -t 2>&1 || true
systemctl is-active nginx 2>/dev/null || true
find /etc/nginx/sites-enabled -maxdepth 1 -type l -printf '%f -> %l\n' 2>/dev/null || true

section "Local API Smoke"
curl -fsS http://127.0.0.1:8000/api/health || true
printf '\n'
curl -fsS 'http://127.0.0.1:8000/api/viewport?date=2024-08-05&bbox=122,27,124.2,29.6&step=4' \
  | head -c 500 || true
printf '\n'

section "Cache Counts"
find "$DATA_DIR/cache" -type f 2>/dev/null | wc -l | awk '{print "cache_files: " $1}' || true
find "$DATA_DIR/cache/viewport" -type f -name '*.json' 2>/dev/null | wc -l | awk '{print "viewport_cache_json: " $1}' || true

section "Reminder"
cat <<'TEXT'
Keep real server IPs, SSH key paths, credentials, raw AIS/GFW, and incident notes out of Git.
Record only summarized capacity constraints and non-sensitive smoke results in docs or issue comments.
TEXT
