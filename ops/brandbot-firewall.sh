#!/usr/bin/env bash
set -euo pipefail

# Docker's published ports bypass UFW INPUT filtering. Protect both IP families
# separately, without flushing Docker or administrator-owned chains.
for firewall in iptables ip6tables; do
    "$firewall" -w -N DOCKER-USER 2>/dev/null || true
    "$firewall" -w -N BRANDBOT-INGRESS 2>/dev/null || true
    "$firewall" -w -F BRANDBOT-INGRESS
    "$firewall" -w -A BRANDBOT-INGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
    for interface in eth+ en+; do
        for port in 80 443; do
            "$firewall" -w -A BRANDBOT-INGRESS -i "$interface" -p tcp -m conntrack --ctdir ORIGINAL --ctorigdstport "$port" -j RETURN
        done
        "$firewall" -w -A BRANDBOT-INGRESS -i "$interface" -j DROP
    done
    "$firewall" -w -A BRANDBOT-INGRESS -j RETURN
    "$firewall" -w -C DOCKER-USER -j BRANDBOT-INGRESS 2>/dev/null || "$firewall" -w -I DOCKER-USER 1 -j BRANDBOT-INGRESS
    "$firewall" -w -C FORWARD -j DOCKER-USER 2>/dev/null || "$firewall" -w -I FORWARD 1 -j DOCKER-USER
done
