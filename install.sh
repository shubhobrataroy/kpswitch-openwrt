#!/bin/sh
# Install kpswitch onto the OpenWrt router. Run from this directory on a computer with SSH access:
#   ./install.sh [root@192.168.1.1]
# An existing /etc/config/kpswitch on the router is left untouched.
set -e
R="${1:-root@192.168.1.1}"
cd "$(dirname "$0")"

V=/www/luci-static/resources/view/kpswitch
ssh "$R" "mkdir -p $V"
scp -O -q kpswitch "$R:/usr/sbin/kpswitch"
scp -O -q rpcd-kpswitch "$R:/usr/libexec/rpcd/kpswitch"
scp -O -q rpcd-acl.json "$R:/usr/share/rpcd/acl.d/luci-app-kpswitch.json"
scp -O -q luci/menu.json "$R:/usr/share/luci/menu.d/luci-app-kpswitch.json"
scp -O -q luci/status.js luci/config.js "$R:$V/"
scp -O -q kpswitch.config "$R:/tmp/kpswitch.config"
ssh "$R" '
	chmod 755 /usr/sbin/kpswitch /usr/libexec/rpcd/kpswitch
	rm -f /usr/share/rpcd/acl.d/kpswitch.json
	if [ -s /etc/config/kpswitch ]; then rm /tmp/kpswitch.config
	else mv /tmp/kpswitch.config /etc/config/kpswitch; fi
	chmod 600 /etc/config/kpswitch
	# keep it across sysupgrade
	for f in /usr/sbin/kpswitch /usr/libexec/rpcd/kpswitch \
		/usr/share/rpcd/acl.d/luci-app-kpswitch.json \
		/usr/share/luci/menu.d/luci-app-kpswitch.json \
		/www/luci-static/resources/view/kpswitch/; do
		grep -qxF "$f" /etc/sysupgrade.conf 2>/dev/null || echo "$f" >> /etc/sysupgrade.conf
	done
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache
	/etc/init.d/rpcd restart
	echo "installed. LuCI: Network > Managed Switch (log out and back in to LuCI once)."
'
