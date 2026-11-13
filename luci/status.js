'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

var call = function(method) {
	return rpc.declare({ object: 'kpswitch', method: method });
};

var callInfo = call('info'), callPorts = call('ports'), callVlans = call('vlans'),
    callMac = call('mac'), callDiff = call('diff'), callApply = call('apply'),
    callSave = call('save'), callImport = call('import');

function table(heads, rows) {
	return E('table', { 'class': 'table' }, [
		E('tr', { 'class': 'tr table-titles' }, heads.map(function(h) {
			return E('th', { 'class': 'th' }, [ h ]);
		}))
	].concat(rows.map(function(r) {
		return E('tr', { 'class': 'tr' }, r.map(function(c) {
			return E('td', { 'class': 'td' }, [ (c instanceof Node) ? c : String(c == null ? '' : c) ]);
		}));
	})));
}

function portStyle(p) {
	var base = 'display:inline-block;width:64px;margin:0 6px 6px 0;padding:6px 0;text-align:center;border-radius:6px;border:2px solid ';
	if (!p.enabled)
		return base + '#999;border-style:dashed;opacity:.5';
	if (!p.link)
		return base + '#999;opacity:.7';
	if (p.speed >= 2500)
		return base + '#2e7d32;background:#2e7d32;color:#fff';
	if (p.speed >= 1000)
		return base + '#1565c0;background:#1565c0;color:#fff';
	return base + '#ef6c00;background:#ef6c00;color:#fff';
}

function speedText(p) {
	if (!p.enabled) return _('disabled');
	if (!p.link) return _('no link');
	return p.speed >= 1000 ? (p.speed / 1000) + 'G' : p.speed + 'M';
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callInfo(), {}),
			L.resolveDefault(callPorts(), {}),
			L.resolveDefault(callVlans(), {}),
			L.resolveDefault(callMac(), {})
		]);
	},

	updatePorts: function(ports) {
		var now = Date.now(), prev = this.prev, devs = this.devs || {};
		var dt = prev ? (now - prev.t) / 1000 : 0;

		var rate = function(p, key) {
			if (!prev || dt <= 0 || !prev.ports[p.port]) return '-';
			var d = (p[key] - prev.ports[p.port][key]) / dt;
			return d < 0 ? '-' : Math.round(d).toLocaleString();
		};

		L.dom.content(this.strip, ports.map(function(p) {
			return E('div', { 'style': portStyle(p), 'title': p.actual }, [
				E('div', { 'style': 'font-weight:bold' }, [ String(p.port) + (p.port == 9 ? ' SFP+' : '') ]),
				E('div', { 'style': 'font-size:85%' }, [ speedText(p) ])
			]);
		}));

		L.dom.content(this.portTable, table(
			[ _('Port'), _('State'), _('Link'), _('Speed setting'), _('Flow control'), _('PVID'), _('Accepts'), _('Devices'),
			  _('TX packets'), _('RX packets'), _('TX pkt/s'), _('RX pkt/s'), _('Bad TX/RX') ],
			ports.map(function(p) {
				return [
					p.port, p.enabled ? _('enabled') : _('disabled'), p.actual, p.speed_config,
					p.flow_control ? _('on') : _('off'), p.pvid, p.accept, devs[p.port] || 0,
					p.tx_packets.toLocaleString(), p.rx_packets.toLocaleString(),
					rate(p, 'tx_packets'), rate(p, 'rx_packets'), p.tx_bad + ' / ' + p.rx_bad
				];
			})
		));

		var map = {};
		ports.forEach(function(p) { map[p.port] = p; });
		this.prev = { t: now, ports: map };
	},

	updateMac: function(entries) {
		var devs = {};
		entries.forEach(function(e) { devs[e.port] = (devs[e.port] || 0) + 1; });
		this.devs = devs;
		entries.sort(function(a, b) { return a.port - b.port || a.vid - b.vid; });
		L.dom.content(this.macTable, table(
			[ _('Port'), _('VLAN'), _('MAC address'), _('IP address'), _('Hostname'), _('Type') ],
			entries.map(function(e) { return [ e.port, e.vid, e.mac, e.ip, e.host, e.type ]; })
		));
	},

	result: function(title, r, extra) {
		var text = (r && r.output) ? r.output : _('No reply from the router.');
		ui.showModal(title, [
			E('pre', { 'style': 'white-space:pre-wrap' }, [ text ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ])
			].concat(extra || []))
		]);
	},

	run: function(fn, title) {
		ui.showModal(title, [ E('p', { 'class': 'spinning' }, [ _('Talking to the switch…') ]) ]);
		return fn().then(L.bind(function(r) {
			this.result(title, r);
			return callPorts();
		}, this)).then(L.bind(function(r) {
			if (r && r.ports) this.updatePorts(r.ports);
		}, this)).catch(L.bind(function(e) {
			this.result(title, { output: String(e) });
		}, this));
	},

	handlePreview: function() {
		return callDiff().then(L.bind(function(r) {
			var extra = [];
			if (r && r.code === 0 && r.pending > 0)
				extra = [ ' ', E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'run', callApply, _('Apply to switch'))
				}, [ _('Apply to switch') ]) ];
			this.result(_('Pending changes'), r, extra);
		}, this));
	},

	confirm: function(title, text, label, fn) {
		ui.showModal(title, [
			E('p', {}, [ text ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Cancel') ]), ' ',
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': ui.createHandlerFn(this, 'run', fn, title)
				}, [ label ])
			])
		]);
	},

	handleSaveFlash: function() {
		this.confirm(_('Save to switch flash'),
			_('Store the switch\'s running settings in its flash so they survive a power-cycle?'),
			_('Save'), callSave);
	},

	handleImport: function() {
		this.confirm(_('Import from switch'),
			_('Replace the port and VLAN settings stored on the router with what the switch is running now?'),
			_('Import'), callImport);
	},

	render: function(data) {
		var info = data[0] || {}, ports = (data[1] || {}).ports || [],
		    vlans = (data[2] || {}).vlans || [], mac = (data[3] || {}).entries || [];
		var err = info.error || (data[1] || {}).error;

		this.strip = E('div', { 'style': 'margin:8px 0' });
		this.portTable = E('div');
		this.macTable = E('div');

		var body = [ E('h2', {}, [ _('Managed Switch') ]) ];

		if (err) {
			body.push(E('div', { 'class': 'alert-message warning' }, [
				E('strong', {}, [ _('Cannot read the switch: ') ]), err
			]));
			return E('div', {}, body);
		}

		this.updateMac(mac);
		this.updatePorts(ports);

		body.push(
			E('div', { 'class': 'cbi-map-descr' }, [
				'%s · %s %s (%s) · %s · %s'.format(
					info.device_model || '?', _('firmware'), info.firmware_version || '?',
					info.firmware_date || '?', info.ip_address || '?', info.mac_address || '?')
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('Ports') ]),
				this.strip,
				this.portTable
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('VLANs') ]),
				table([ _('VLAN'), _('Name'), _('Untagged ports'), _('Tagged ports') ],
					vlans.map(function(v) {
						return [ v.vid, v.name || '-', v.untagged.join(', ') || '-', v.tagged.join(', ') || '-' ];
					}))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('Router configuration') ]),
				E('p', {}, [ _('Settings edited on the Configuration tab reach the switch only when applied here.') ]),
				E('button', {
					'class': 'btn cbi-button-action',
					'click': ui.createHandlerFn(this, 'handlePreview')
				}, [ _('Preview and apply changes') ]), ' ',
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.createHandlerFn(this, 'handleSaveFlash')
				}, [ _('Save to switch flash') ]), ' ',
				E('button', {
					'class': 'btn cbi-button',
					'click': ui.createHandlerFn(this, 'handleImport')
				}, [ _('Import from switch') ])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, [ _('Connected devices') ]),
				this.macTable
			])
		);

		poll.add(L.bind(function() {
			return callPorts().then(L.bind(function(r) {
				if (r && r.ports) this.updatePorts(r.ports);
			}, this));
		}, this), 5);

		return E('div', {}, body);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
