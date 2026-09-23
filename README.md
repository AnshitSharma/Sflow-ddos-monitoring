# sFlow-RT long-term monitoring — Custom NOC Dashboard

sFlow-RT keeps only the last few minutes of data in memory. This stack copies
that data out so you can look back up to **30 days** (e.g. to review past DDoS
events), visualized in a custom dark NOC dashboard.

The whole stack runs on **our own VM** with its own Prometheus and OpenSearch.
It only *reads* from the existing sFlow-RT (`https://noc.bharatdatacenter.com/sflow`)
— the switches and sFlow-RT stay exactly as they are.

```
                          ┌─► Prometheus (30d) ─┐
  switches ─► sFlow-RT ───┤    /prometheus/...   ├─► Next.js NOC Dashboard  (/dashboard/)
 (2 agents)  (real-time)  │                      │   Live + Historical
                          └─► collector → OpenSearch (30d)
                               /flows/json          (forensics search)
```

* **Prometheus** scrapes sFlow-RT every 15 s, keeps 30 days of metrics.
* **OpenSearch** stores individual flow-log records (30 days).
* **webapp** — custom Next.js dashboard: Overview, Interfaces, Traffic Analytics, DDoS, Flow Forensics, Agents.

---

## 1. VM requirements

| | Minimum | Recommended |
|---|---|---|
| OS | Rocky / Alma / RHEL 9, or Ubuntu 22.04+ / Debian 12 (64-bit) | same |
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB (OpenSearch 1 GB heap + Next.js build) |
| Disk | 60 GB | 100 GB+ SSD (Prometheus capped at 40 GB, rest for OpenSearch + images) |
| Network | Outbound HTTPS (443) to `noc.bharatdatacenter.com` | same |

Software (installed by the setup script): **Docker Engine**, **Docker Compose
plugin**, `git`, `curl`, `jq`. Everything else — Prometheus, OpenSearch,
Python, Node.js — runs inside containers, so nothing else goes on the host.

Optional, only for browser access with login + HTTPS: **Apache (httpd)** or
nginx as a reverse proxy (step 5).

## 2. Get the code and configure

```bash
git clone <this repo> sflow-monitoring && cd sflow-monitoring
cp .env.example .env
vi .env          # set SFLOWRT_PASS (and check SFLOWRT_URL / SFLOWRT_USER)
```

## 3. Install and start everything

```bash
sudo bash scripts/setup-vm.sh
```

This installs Docker, sets `vm.max_map_count` for OpenSearch, writes the
git-ignored `prometheus/sflowrt_password` file from `.env`, checks the VM can
reach sFlow-RT, then builds and starts all 4 services
(prometheus, opensearch, collector, webapp).

Check every Prometheus scrape job is `up`:

```bash
curl -s http://127.0.0.1:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health, lastError}'
```

## 4. Verify the dashboard is up (on the server)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/dashboard
# → 200

curl -s 'http://127.0.0.1:3001/dashboard/api/live/version' | head -c 100
# → sFlow-RT version JSON

curl -s 'http://127.0.0.1:3001/dashboard/api/metrics?query=sflow_analyzer_agent_count' | head -c 150
# → Prometheus result JSON
```

## 5. Browser access and login

Open **`https://<SITE_ADDRESS>/dashboard`** (e.g. `https://157.10.98.155/dashboard`)
and sign in with `DASHBOARD_USER` / `DASHBOARD_PASSWORD` from `.env`.

* The `proxy` service (Caddy) serves HTTPS on 443 and redirects 80 → 443.
* With an IP address the certificate is self-signed, so the browser (or
  antivirus) shows a one-time "untrusted certificate" warning. To get a trusted
  certificate, point a DNS name at the VM, then in `.env` set
  `SITE_ADDRESS=<that name>` and `SITE_TLS=tls you@example.com`, and run
  `docker compose up -d proxy`.
* Every page and API route requires a session (12 h). Wrong passwords are
  limited to 10 attempts per 15 minutes per IP.
* To change the password: edit `DASHBOARD_PASSWORD` in `.env`, then
  `docker compose up -d webapp`. To force everyone to log out, change `AUTH_SECRET`.

## 6. Flow forensics

The Flow Forensics page searches OpenSearch. Flow records only appear when a
`log:true` flow event fires (flood, bad-protocol, BGP, etc.) — empty is normal
until something happens on the network.

Test with:
```bash
curl -s 'http://127.0.0.1:9200/sflow-flows-*/_count' | jq .count
```

## Adjusting retention

* **Metrics:** change `--storage.tsdb.retention.time=30d` (and the
  `--storage.tsdb.retention.size=40GB` disk cap) in `docker-compose.yml`.
* **Flows:** change `RETENTION_DAYS` in `.env`.

## Notes

* All ports bound to `127.0.0.1` — nothing is publicly exposed without Apache.
* OpenSearch security plugin is disabled (localhost-only, single-node).
* Credentials stay server-side — the browser only talks to `/dashboard/api/*`.
* New switches are picked up automatically (`ALL/ALL` wildcard in Prometheus config).
