# sFlow-RT long-term monitoring — Custom NOC Dashboard

sFlow-RT keeps only the last few minutes of data in memory. This stack copies
that data out so you can look back **24 hours / 7 days**, visualized in a
custom dark NOC dashboard.

```
                          ┌─► Prometheus (7d)  ─┐
  switches ─► sFlow-RT ───┤    /prometheus/...   ├─► Next.js NOC Dashboard  (/dashboard/)
 (2 agents)  (real-time)  │                      │   Live + Historical
                          └─► collector → OpenSearch (7d)
                               /flows/json          (forensics search)
```

* **Prometheus** scrapes sFlow-RT every 15 s, keeps 7 days of metrics.
* **OpenSearch** stores individual flow-log records (7 days).
* **webapp** — custom Next.js dashboard: Overview, Interfaces, Traffic Analytics, DDoS, Flow Forensics, Agents.

---

## 1. Prerequisites (on the NOC server)

```bash
sudo dnf install -y docker docker-compose-plugin
sudo systemctl enable --now docker
sudo sysctl -w vm.max_map_count=262144
echo 'vm.max_map_count=262144' | sudo tee /etc/sysctl.d/99-opensearch.conf
```

## 2. Configure

```bash
cp .env.example .env
# verify SFLOWRT_URL / SFLOWRT_USER / SFLOWRT_PASS are correct
```

## 3. Build & run

```bash
docker compose build webapp     # first time only, ~2 min
docker compose up -d
docker compose ps               # all 4 services: prometheus, opensearch, collector, webapp
```

## 4. Verify the dashboard is up (on the server)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/dashboard/
# → 200

curl -s 'http://127.0.0.1:3001/dashboard/api/live/version' | head -c 100
# → sFlow-RT version JSON

curl -s 'http://127.0.0.1:3001/dashboard/api/metrics?query=sflow_analyzer_agent_count' | head -c 150
# → Prometheus result JSON
```

## 5. Apache reverse proxy (persistent access)

```bash
# Ensure proxy modules are loaded:
httpd -M | grep proxy

# Add config (see apache-dashboard.conf) to your HTTPS vhost, then:
sudo apachectl configtest && sudo systemctl reload httpd
```

Open `https://noc.bharatdatacenter.com/dashboard/` — login with your existing admin credentials.

## 6. Flow forensics

The Flow Forensics page searches OpenSearch. Flow records only appear when a
`log:true` flow event fires (flood, bad-protocol, BGP, etc.) — empty is normal
until something happens on the network.

Test with:
```bash
curl -s 'http://127.0.0.1:9200/sflow-flows-*/_count' | jq .count
```

## Adjusting retention

* **Metrics:** change `--storage.tsdb.retention.time=7d` in `docker-compose.yml`.
* **Flows:** change `RETENTION_DAYS` in `.env`.

## Notes

* All ports bound to `127.0.0.1` — nothing is publicly exposed without Apache.
* OpenSearch security plugin is disabled (localhost-only, single-node).
* Credentials stay server-side — the browser only talks to `/dashboard/api/*`.
* New switches are picked up automatically (`ALL/ALL` wildcard in Prometheus config).
