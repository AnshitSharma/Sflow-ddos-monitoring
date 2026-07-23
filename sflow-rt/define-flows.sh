#!/usr/bin/env bash
# Defines the live-flow used by the webapp's Flow Explorer (per-IP drill).
#
# WHY: sFlow-RT computes top flows in RAM. The Flow Explorer queries
#   GET /activeflows/ALL/ip_pairs/json   (top source->destination pairs)
# Click-to-filter is handled at runtime by the webapp (POST /api/flowfocus),
# which bakes the filter into an `ip_pairs_focus` flow — sFlow-RT does NOT
# filter /activeflows at query time, so the filter must live in a flow def.
#
# NOTE: DDoS detection is ALREADY provided by sFlow-RT's built-in `ddos-protect`
# app (flows ddos_protect_udp_flood / tcp_flood / *_amplification / *_fragmentation
# + matching thresholds). The DDoS page just reads GET /events/json. Do NOT
# redefine those here — they are managed by the app and persist via its config.
#
# REST-defined flows are in-memory and lost on sFlow-RT restart. Re-run this after
# a restart, or move the `ip_pairs` definition into an sFlow-RT init script to persist.
#
# Usage:
#   SFLOWRT_URL=https://noc.bharatdatacenter.com/sflow NETRC=/path/to/netrc ./define-flows.sh
#   (NETRC file line:  machine noc.bharatdatacenter.com login admin password ******)
# On the server (no auth):  SFLOWRT_URL=http://localhost:8008 ./define-flows.sh
set -euo pipefail

SF="${SFLOWRT_URL:-http://localhost:8008}"; SF="${SF%/}"
AUTH=()
[ -n "${NETRC:-}" ] && AUTH=(--netrc-file "$NETRC")
INSECURE=()
[ "${SFLOWRT_INSECURE:-0}" = "1" ] && INSECURE=(-k)

put_flow() {  # name, json-body
  curl -s "${INSECURE[@]}" "${AUTH[@]}" -X PUT "$SF/flow/$1/json" \
    -H 'Content-Type: application/json' -d "$2" -o /dev/null -w "PUT flow/$1 -> %{http_code}\n"
}

# Base top-talkers flow: keys ipsource,ipdestination ; value bytes (UI ×8 -> bps).
put_flow ip_pairs '{"keys":"ipsource,ipdestination","value":"bytes","t":5,"n":50,"activeTimeout":60}'

echo "Done. Verify: curl ${INSECURE[*]} ${AUTH[*]:+--netrc-file <file>} \"$SF/activeflows/ALL/ip_pairs/json?maxFlows=5\""
