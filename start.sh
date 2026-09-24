#!/usr/bin/env bash
# 视唱练耳训练台 - 本地服务启动脚本（macOS / Linux / Git Bash）
set -e
cd "$(dirname "$0")"
PORT="${1:-8765}"
URL="http://localhost:${PORT}/"

echo ""
echo "=================================================="
echo "  视唱练耳训练台  -  本地服务"
echo "  地址: ${URL}"
echo "  停止: 按 Ctrl+C"
echo "=================================================="
echo ""

( sleep 1
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then open "$URL" >/dev/null 2>&1 || true
  fi ) &

if command -v python3 >/dev/null 2>&1; then
  echo "[信息] 使用 python3 启动..."
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  echo "[信息] 使用 python 启动..."
  exec python -m http.server "$PORT"
elif command -v node >/dev/null 2>&1; then
  echo "[信息] 使用 node 启动..."
  exec node tools/serve.js "$PORT"
else
  echo "[错误] 未找到 Python 3 或 Node.js，请先安装其中之一。"
  exit 1
fi
