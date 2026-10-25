#!/usr/bin/env bash
# 海洋锋面 · 服务器端环境安装 + 应用部署（幂等：可反复执行）
#
# 用法（在服务器上，root）：
#   bash /tmp/remote-setup.sh <公网IP> [/tmp/ocean-front-prototype.tar.gz]
#   不带 tar 包 = 只装环境 / 只重建权限与服务，用于「上传数据之后」重跑
#
# 本脚本由本地 deploy/deploy.ps1 上传后执行；重复执行不会产生重复配置。
# 编码约定：本文件必须 LF + UTF-8 无 BOM（CRLF 会让 bash 报 bad interpreter / invalid option）。

set -euo pipefail

SERVER_IP="${1:-}"
TARBALL="${2:-}"
APP_DIR=/opt/ocean
DATA_DIR=/srv/ocean/data
SERVICE_USER=ocean
SERVICE_NAME=ocean-api

log() { printf '\n=== %s ===\n' "$*"; }
warn() { printf '!! %s\n' "$*" >&2; }

[ "$(id -u)" -eq 0 ] || { echo "请用 root 运行（sudo bash $0 <公网IP>）"; exit 1; }
[ -n "$SERVER_IP" ] || { echo "用法: $0 <公网IP> [tar.gz 包路径]"; exit 1; }

# ---------- 1. 基础软件 ----------
log "1/8 安装基础软件（Nginx / Python / MySQL / 工具链）"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  nginx \
  python3-venv python3-pip python3-dev build-essential \
  mysql-server mysql-client \
  curl ca-certificates tzdata

# ---------- 2. Node.js 20（只给 tools/*.mjs 自检脚本用；站点本身不依赖 Node） ----------
log "2/8 确认 Node.js >= 20"
NEED_NODE=1
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
  [ "${NODE_MAJOR:-0}" -ge 20 ] && NEED_NODE=0
fi
if [ "$NEED_NODE" -eq 1 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v || warn "Node 安装异常，仅影响自检脚本"

# ---------- 3. 用户与目录 ----------
log "3/8 创建用户与数据目录"
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$SERVICE_USER"
mkdir -p "$APP_DIR" "$DATA_DIR/raw" "$DATA_DIR/processed" "$DATA_DIR/cache" "$DATA_DIR/outputs" "$DATA_DIR/manifest"

# ---------- 4. 应用代码 ----------
if [ -n "$TARBALL" ] && [ -f "$TARBALL" ]; then
  log "4/8 解包应用到 $APP_DIR（包顶层目录会被剥掉）"
  tar -xzf "$TARBALL" -C "$APP_DIR" --strip-components=1
else
  log "4/8 未提供 tar 包，沿用 $APP_DIR 现有代码"
fi

# ---------- 5. Python 环境与依赖 ----------
if [ -f "$APP_DIR/backend/pyproject.toml" ]; then
  log "5/8 安装后端 Python 依赖（venv + pip install backend）"
  # 后端 pyproject 声明 requires-python >= 3.11：
  # Ubuntu 22.04 自带 3.10 会在 pip 阶段硬失败，这里先给出明确原因，别让人去猜 pip 的报错。
  if ! python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'; then
    warn "系统 python3 版本过低：$(python3 -V)。后端要求 >= 3.11。"
    warn "请改用 Ubuntu 24.04 LTS 镜像（自带 3.12），或自行安装 python3.12 后重跑本脚本。"
    exit 1
  fi
  [ -d "$APP_DIR/venv" ] || python3 -m venv "$APP_DIR/venv"
  "$APP_DIR/venv/bin/pip" install --upgrade pip wheel >/dev/null
  "$APP_DIR/venv/bin/pip" install "$APP_DIR/backend"
else
  warn "5/8 未找到 $APP_DIR/backend/pyproject.toml，跳过 Python 依赖"
fi

# ---------- 6. systemd 服务 ----------
if [ -f "$APP_DIR/deploy/systemd/ocean-api.service" ]; then
  log "6/8 安装并启动 systemd 服务 $SERVICE_NAME"
  cp "$APP_DIR/deploy/systemd/ocean-api.service" "/etc/systemd/system/$SERVICE_NAME.service"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
  systemctl restart "$SERVICE_NAME"
else
  warn "6/8 未找到 systemd 单元，跳过"
fi

# ---------- 7. Nginx 站点 ----------
if [ -f "$APP_DIR/deploy/nginx/ocean.conf" ]; then
  log "7/8 安装 Nginx 站点（server_name=$SERVER_IP）"
  # 别名占位符：@SS_IP@ = IP 连字符形式（例如 <ip-dashed>，sslip.io 的写法）；@SERVER_IP@ = 点分 IP
  IP_DASHED="${SERVER_IP//./-}"
  sed -e "s/@SERVER_IP@/$SERVER_IP/g" -e "s/@SS_IP@/$IP_DASHED/g" \
      "$APP_DIR/deploy/nginx/ocean.conf" > /etc/nginx/sites-available/ocean
  ln -sf /etc/nginx/sites-available/ocean /etc/nginx/sites-enabled/ocean
  nginx -t
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl reload nginx
  # 若本机启用了 ufw，放行 80（阿里云安全组仍需单独放行）
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    ufw allow OpenSSH >/dev/null || true
    ufw allow 80/tcp >/dev/null || true
  fi
else
  warn "7/8 未找到 nginx 站点配置，跳过"
fi

# ---------- 8. 权限收口 + MySQL + 自检 ----------
log "8/8 权限收口与自检"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR"

systemctl is-active mysql >/dev/null 2>&1 || systemctl enable --now mysql >/dev/null 2>&1 || true
if mysql -e "CREATE DATABASE IF NOT EXISTS db_prac CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>/dev/null; then
  echo "MySQL 库 db_prac 就绪（默认仅监听 127.0.0.1）"
else
  warn "MySQL 建库失败：Ubuntu 默认 root 走 auth_socket，见 deploy/RUNBOOK.md 排错表"
fi

RAW_COUNT="$(find "$DATA_DIR/raw" -name '*.nc' 2>/dev/null | wc -l | tr -d ' ')"
echo "已就位原始数据文件数：$RAW_COUNT（0 表示还没上传数据）"

echo "-- API 健康检查 --"
# 必须带 Host 头：Nginx 站点用真实 IP 作 server_name，
# 若用 `curl http://127.0.0.1/api/health`（Host=127.0.0.1）会匹配不到本站点、落到发行版默认站点，
# 表现为 nginx 的 404 —— 与后端无关，纯属自检写法问题。
curl -fsS -H "Host: $SERVER_IP" "http://127.0.0.1/api/health" || warn "API 未就绪，排查：journalctl -u $SERVICE_NAME -n 50 --no-pager"
echo
echo "-- 站点状态码 --"
SITE_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -H "Host: $SERVER_IP" http://127.0.0.1/)"
printf 'GET http://127.0.0.1/  → HTTP=%s\n' "$SITE_CODE"

log "完成。公网验收（在你本机用 curl.exe 执行，别用 Invoke-WebRequest）："
printf 'curlexe "http://%s/api/health"\n' "$SERVER_IP"
