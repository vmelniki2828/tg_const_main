#!/usr/bin/env bash
set -euo pipefail

exec 9>/run/lock/brandbot-cert-renew.lock
flock -n 9 || exit 0

docker run --rm --name brandbot-certbot-renew --dns 1.1.1.1 --dns 8.8.8.8 \
    -v /home/brandbot-infra/letsencrypt:/etc/letsencrypt \
    -v /home/brandbot-infra/certbot-work:/var/lib/letsencrypt \
    -v /home/brandbot-infra/certbot-logs:/var/log/letsencrypt \
    -v /home/brandbot-infra/acme:/var/www/acme \
    certbot/certbot@sha256:bc93cb710b413e6b456d622f9b0133b3e109c0a78c2ed9976af43d209b0a1805 \
    renew --non-interactive --no-random-sleep-on-renew "$@"

cd /home/tg_const_main
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
