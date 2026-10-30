# Production ingress

The panel is served at https://brandbot.titanteam.org. Frontend assets use `/`,
backend routes use `/api/`, and `/uploads/` passes through backend authentication.
Production JavaScript defaults to the page origin. Local development still uses
port 3001. Build-time `REACT_APP_API_URL`, if supplied, overrides that default.

Only ingress nginx publishes Docker ports (80 and 443). MongoDB, backend and
frontend communicate on the Compose network without host port mappings. Both
nginx images use stable version 1.30.6. HTTP redirects to the fixed HTTPS domain,
except the ACME webroot. TLS permits versions 1.2 and 1.3.

Before starting production Compose, obtain a certificate using the webroot under
`/home/brandbot-infra/acme` and persist Certbot state under
`/home/brandbot-infra/letsencrypt`. The ingress mounts both directories read-only.
Certificate keys and rollback files stay outside the repository and containers.
Do not commit certificate state or `backend/.auth.env`.

In `backend/.auth.env`, preserve the session secret, set
`AUTH_COOKIE_SECURE=true`, and trust only loopback and the actual Docker network
subnet (`AUTH_TRUST_PROXY=loopback,172.18.0.0/16` on the current host). Compose
allows only `https://brandbot.titanteam.org` as the browser Origin.

## Host controls

Host UFW permits TCP 22, 80 and 443, denies other incoming traffic, and permits
outgoing traffic. The unused host MongoDB service binds only to 127.0.0.1.
Removing Docker port mappings is essential because Docker forwarding bypasses
UFW's INPUT rules.

`ops/brandbot-firewall.sh` additionally filters Docker forwarding from Ethernet
interfaces for IPv4 and IPv6. It allows established traffic and new HTTP/HTTPS
connections, and drops other incoming forwarded traffic. Its systemd service is
enabled at boot and with the installed Snap Docker service. Reassess interface
names and service dependencies when migrating hosts or Docker distributions.

Install the scripts in `/usr/local/sbin/brandbot-firewall` and
`/usr/local/sbin/brandbot-cert-renew` (root-owned, mode 0750), and the unit files
under `/etc/systemd/system/`. Enable `brandbot-firewall.service` and
`brandbot-cert-renew.timer` after `systemctl daemon-reload`.

Certificate renewal runs twice daily with a random delay. The pinned Certbot
image renews through HTTP webroot; nginx configuration is validated before reload.
No Docker socket is mounted in the Certbot container. Test the full path using
`/usr/local/sbin/brandbot-cert-renew --dry-run`, and inspect
`journalctl -u brandbot-cert-renew.service` and `systemctl list-timers`.

## Verification and rollback

Check `docker compose exec -T nginx nginx -t`, a trusted HTTPS request to
`/api/health`, HTTP redirect, unauthenticated API rejection, secure session login,
and polling health for every active bot. Scan the server externally for ports
22, 80, 443, 3000, 3001, 27017 and 27018. Confirm only the first three accept
connections and that renewal dry-run succeeds after firewall activation.

The initial migration backup is under
`/home/brandbot-infra/rollback-20261030` (root-only), including a MongoDB archive,
old Compose/nginx configuration, session configuration and firewall rules.
Images tagged `before-https` preserve the previous backend/frontend release.
Never remove the MongoDB volume during rollback. Restoring the former HTTP
deployment also requires restoring its cookie/Origin settings and deliberately
reviewing which published ports, if any, should be reopened.
