#!/usr/bin/env bash
# One-shot setup for hosting this whole stack on our own VM.
#
# Installs Docker Engine + Compose plugin, tunes the kernel for OpenSearch,
# writes the sFlow-RT password file Prometheus needs, checks the VM can reach
# sFlow-RT, then builds and starts all containers.
#
# Supports RHEL-family (Rocky / Alma / RHEL / CentOS Stream) and Debian/Ubuntu.
#
# Usage (from the repo root, after `cp .env.example .env` and filling it in):
#   sudo bash scripts/setup-vm.sh
set -euo pipefail

cd "$(dirname "$0")/.."

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
[ -f .env ] || { echo "Missing .env — run: cp .env.example .env  and fill it in."; exit 1; }

# ---- 1. Packages ------------------------------------------------------------
. /etc/os-release
if command -v dnf >/dev/null 2>&1; then
  dnf install -y dnf-plugins-core git curl jq openssl
  dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
elif command -v apt-get >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl gnupg git jq openssl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "Unsupported OS: ${PRETTY_NAME:-unknown}"; exit 1
fi
systemctl enable --now docker

# ---- 2. Kernel setting required by OpenSearch -------------------------------
sysctl -w vm.max_map_count=262144
echo 'vm.max_map_count=262144' > /etc/sysctl.d/99-opensearch.conf

# ---- 3. Secrets -------------------------------------------------------------
set -a; . ./.env; set +a
[ -n "${SFLOWRT_PASS:-}" ] && [ "$SFLOWRT_PASS" != "change-me" ] \
  || { echo "Set SFLOWRT_PASS in .env first."; exit 1; }
[ -n "${DASHBOARD_PASSWORD:-}" ] && [ "$DASHBOARD_PASSWORD" != "change-me" ]   || { echo "Set DASHBOARD_PASSWORD in .env first."; exit 1; }
if [ -z "${AUTH_SECRET:-}" ]; then
  AUTH_SECRET=$(openssl rand -hex 32)
  sed -i "s/^AUTH_SECRET=.*/AUTH_SECRET=${AUTH_SECRET}/" .env
fi
printf '%s' "$SFLOWRT_PASS" > prometheus/sflowrt_password
chown 65534:65534 prometheus/sflowrt_password   # Prometheus runs as 'nobody'
chmod 400 prometheus/sflowrt_password
chmod 600 .env

# ---- 4. Can this VM reach sFlow-RT? -----------------------------------------
INSECURE=(); [ "${SFLOWRT_INSECURE:-0}" = "1" ] && INSECURE=(-k)
code=$(curl -s "${INSECURE[@]}" -u "${SFLOWRT_USER}:${SFLOWRT_PASS}" -o /dev/null \
  -w '%{http_code}' "${SFLOWRT_URL%/}/version" || true)
if [ "$code" != "200" ]; then
  echo "WARNING: ${SFLOWRT_URL}/version returned HTTP ${code:-none}."
  echo "         Check outbound HTTPS from this VM and the credentials in .env."
fi

# ---- 5. Build and start -----------------------------------------------------
docker compose build
docker compose up -d
docker compose ps

echo
# Open the web ports if firewalld is running (cloud firewalls are separate).
if systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-service=http --add-service=https && firewall-cmd --reload
fi

echo "Done. Open https://${SITE_ADDRESS}/dashboard in a browser."
echo "Checks:"
echo "  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3001/dashboard"
echo "  curl -s http://127.0.0.1:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health}'"
