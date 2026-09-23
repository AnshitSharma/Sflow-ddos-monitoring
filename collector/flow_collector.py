"""
sFlow-RT flow-log -> OpenSearch collector.

Long-polls sFlow-RT's /flows/json endpoint for logged flow records (the flows
defined with "log": true, e.g. ixp_flood_local, ixp_badprotocol, ixp_bgp ...)
and bulk-indexes them into daily OpenSearch indices for forensic search.

The poll cursor is sFlow-RT's `flowID` parameter (only records newer than it
are returned; the request blocks up to `timeout` ms until one arrives). Each
document gets a deterministic _id, so re-reading sFlow-RT's backlog after a
collector restart overwrites instead of duplicating.

Old indices past RETENTION_DAYS are deleted once a day.
"""
import os
import sys
import json
import time
import datetime as dt

import requests
import urllib3

# --- config from environment -------------------------------------------------
SFLOWRT_URL   = os.environ.get("SFLOWRT_URL", "http://localhost:8008").rstrip("/")
SFLOWRT_USER  = os.environ.get("SFLOWRT_USER", "")
SFLOWRT_PASS  = os.environ.get("SFLOWRT_PASS", "")
SFLOWRT_INSEC = os.environ.get("SFLOWRT_INSECURE", "0") == "1"
OPENSEARCH    = os.environ.get("OPENSEARCH_URL", "http://opensearch:9200").rstrip("/")
FLOW_NAMES    = os.environ.get("FLOW_NAMES", "").strip()
RETENTION     = int(os.environ.get("RETENTION_DAYS", "7"))
POLL_TIMEOUT  = int(os.environ.get("POLL_TIMEOUT_MS", "20000"))   # long-poll window
INDEX_PREFIX  = "sflow-flows"

if SFLOWRT_INSEC:
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

sf = requests.Session()
if SFLOWRT_USER:
    sf.auth = (SFLOWRT_USER, SFLOWRT_PASS)
sf.verify = not SFLOWRT_INSEC


def log(msg):
    print(f"{dt.datetime.utcnow().isoformat()}Z  {msg}", flush=True)


# --- OpenSearch helpers ------------------------------------------------------
def wait_for_opensearch():
    for _ in range(60):
        try:
            r = requests.get(f"{OPENSEARCH}/_cluster/health", timeout=5)
            if r.ok:
                log(f"OpenSearch up: status={r.json().get('status')}")
                return
        except requests.RequestException:
            pass
        log("waiting for OpenSearch ...")
        time.sleep(3)
    log("ERROR: OpenSearch never became reachable")
    sys.exit(1)


def ensure_template():
    """Index template so flow fields are typed for search/aggregation."""
    body = {
        "index_patterns": [f"{INDEX_PREFIX}-*"],
        "template": {
            "settings": {"number_of_shards": 1, "number_of_replicas": 0},
            "mappings": {
                "properties": {
                    "@timestamp": {"type": "date"},
                    "name":       {"type": "keyword"},
                    "agent":      {"type": "ip"},
                    "dataSource": {"type": "keyword"},
                    "value":      {"type": "double"},
                    "flowKeys":   {"type": "keyword"},
                    "keys":       {"type": "keyword"},
                    "flowID":     {"type": "long"},
                }
            },
        },
    }
    r = requests.put(f"{OPENSEARCH}/_index_template/{INDEX_PREFIX}",
                     json=body, timeout=10)
    log(f"index template: HTTP {r.status_code}")


def bulk_index(records):
    if not records:
        return
    lines = []
    for rec in records:
        doc = dict(rec)
        # Event time from sFlow-RT (epoch ms); fall back to "now".
        ms = rec.get("end") or rec.get("start")
        ts = (dt.datetime.utcfromtimestamp(ms / 1000) if isinstance(ms, (int, float)) and ms > 0
              else dt.datetime.utcnow())
        doc["@timestamp"] = ts.isoformat() + "Z"
        fk = rec.get("flowKeys")
        if isinstance(fk, str):
            # split on common separators so each key is searchable on its own
            doc["keys"] = [k for k in fk.replace("_SEP_", ",").split(",") if k]
        doc_id = f"{rec.get('agent')}|{rec.get('name')}|{rec.get('flowID')}|{rec.get('start')}"
        lines.append(json.dumps({"index": {"_index": f"{INDEX_PREFIX}-{ts:%Y.%m.%d}", "_id": doc_id}}))
        lines.append(json.dumps(doc))
    payload = "\n".join(lines) + "\n"
    r = requests.post(f"{OPENSEARCH}/_bulk",
                      data=payload,
                      headers={"Content-Type": "application/x-ndjson"},
                      timeout=30)
    if not r.ok:
        log(f"bulk error HTTP {r.status_code}: {r.text[:300]}")
    else:
        log(f"indexed {len(records)} flow(s)")


def purge_old_indices():
    """Delete indices older than RETENTION days (by date in the name)."""
    try:
        r = requests.get(f"{OPENSEARCH}/_cat/indices/{INDEX_PREFIX}-*?h=index",
                         timeout=10)
        if not r.ok:
            return
        cutoff = dt.datetime.utcnow().date() - dt.timedelta(days=RETENTION)
        for name in r.text.split():
            try:
                d = dt.datetime.strptime(name[len(INDEX_PREFIX) + 1:],
                                         "%Y.%m.%d").date()
            except ValueError:
                continue
            if d < cutoff:
                requests.delete(f"{OPENSEARCH}/{name}", timeout=10)
                log(f"purged old index {name} (older than {RETENTION}d)")
    except requests.RequestException as e:
        log(f"purge error: {e}")


# --- main loop ---------------------------------------------------------------
def main():
    log(f"collector starting -> sFlow-RT={SFLOWRT_URL}  OpenSearch={OPENSEARCH}")
    log(f"flows={'ALL log:true' if not FLOW_NAMES else FLOW_NAMES}  retention={RETENTION}d")
    wait_for_opensearch()
    ensure_template()

    # sFlow-RT's long-poll `timeout` is in seconds.
    params = {"maxFlows": 1000, "timeout": max(1, POLL_TIMEOUT // 1000), "flowID": -1}
    if FLOW_NAMES:
        params["name"] = FLOW_NAMES

    last_purge = 0.0
    while True:
        try:
            r = sf.get(f"{SFLOWRT_URL}/flows/json", params=params,
                       timeout=(POLL_TIMEOUT / 1000) + 15)
            r.raise_for_status()
            flows = r.json()
            if flows:
                bulk_index(flows)
                # advance cursor to the newest flowID we have seen
                max_id = max((f.get("flowID", -1) for f in flows), default=-1)
                if max_id >= 0:
                    params["flowID"] = max_id
        except requests.RequestException as e:
            log(f"poll error: {e} (retry in 5s)")
            time.sleep(5)

        # daily housekeeping
        if time.time() - last_purge > 3600:
            purge_old_indices()
            last_purge = time.time()


if __name__ == "__main__":
    main()
