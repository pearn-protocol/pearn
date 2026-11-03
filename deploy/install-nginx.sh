#!/usr/bin/env bash
# Installs the host nginx configs for pearn.site on the VPS. Run as root from a copy of deploy/:
#   sudo bash install-nginx.sh
# 1. HTTP-only stubs for names that have no certificate yet, so certbot's webroot challenge works.
# 2. certbot (as the cuyvps user, its usual config dir) for each missing name.
# 3. The full configs from this directory; the old sslip.io site files are replaced, since each
#    new config also serves its old name as a redirect. nginx -t gates every reload; on a failure
#    the previous configs (backed up under /var/backups/pearn-nginx/) come back.
set -euo pipefail

DIR=$(cd "$(dirname "$0")" && pwd)
AVAIL=/etc/nginx/sites-available
ENABLED=/etc/nginx/sites-enabled
LIVE=/home/cuyvps/le/config/live
OLD_SUFFIX=103.150.190.91.sslip.io
# config file → the name it serves
declare -A SITES=(
	[nginx.conf]=pearn.site
	[nginx-app.conf]=app.pearn.site
	[nginx-docs.conf]=docs.pearn.site
	[nginx-indexer.conf]=indexer.pearn.site
)

reload() { nginx -t && systemctl reload nginx; }

for name in "${SITES[@]}"; do
	[ -e "$LIVE/$name/fullchain.pem" ] && continue
	printf 'server {\n    listen 80;\n    listen [::]:80;\n    server_name %s;\n    location /.well-known/acme-challenge/ { root /home/cuyvps/acme; }\n    location / { return 404; }\n}\n' \
		"$name" >"$AVAIL/$name"
	ln -sf "$AVAIL/$name" "$ENABLED/$name"
done
reload

for name in "${SITES[@]}"; do
	[ -e "$LIVE/$name/fullchain.pem" ] && continue
	sudo -u cuyvps certbot certonly --webroot -w /home/cuyvps/acme \
		--config-dir /home/cuyvps/le/config --work-dir /home/cuyvps/le/work --logs-dir /home/cuyvps/le/logs \
		--non-interactive --agree-tos --register-unsafely-without-email --cert-name "$name" -d "$name"
done

# Everything this run replaces goes here first (outside /tmp, so a reboot keeps it).
backup=/var/backups/pearn-nginx/$(date +%Y%m%dT%H%M%S)
mkdir -p "$backup"
restore() {
	echo "nginx -t failed; restoring the previous configs from $backup" >&2
	for file in "${!SITES[@]}"; do
		name=${SITES[$file]}
		old=${name%pearn.site}pearn.$OLD_SUFFIX
		if [ -e "$backup/$name" ]; then
			cp "$backup/$name" "$AVAIL/$name"
		else
			rm -f "$ENABLED/$name"
		fi
		if [ -e "$backup/$old" ]; then
			mv "$backup/$old" "$AVAIL/$old"
			ln -sf "$AVAIL/$old" "$ENABLED/$old"
		fi
	done
	reload
}
for file in "${!SITES[@]}"; do
	name=${SITES[$file]}
	old=${name%pearn.site}pearn.$OLD_SUFFIX
	if [ -e "$AVAIL/$name" ]; then cp "$AVAIL/$name" "$backup/"; fi
	if [ -e "$AVAIL/$old" ]; then
		mv "$AVAIL/$old" "$backup/"
		rm -f "$ENABLED/$old"
	fi
	install -m 644 "$DIR/$file" "$AVAIL/$name"
	ln -sf "$AVAIL/$name" "$ENABLED/$name"
done
if ! reload; then
	restore
	exit 1
fi
echo "pearn.site live; previous configs kept in $backup"
