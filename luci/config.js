'use strict';
'require view';
'require form';

var NPORTS = 9;

function portChoices(o) {
	for (var i = 1; i <= NPORTS; i++)
		o.value(String(i), i == 9 ? '9 (SFP+)' : String(i));
}

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('kpswitch', _('Managed Switch'),
			_('These settings are stored on the router. After "Save & Apply", open the Status tab and use "Preview and apply changes" to push them to the switch.'));

		s = m.section(form.NamedSection, 'main', 'switch', _('Connection'));

		o = s.option(form.Value, 'host', _('Switch address'));
		o.datatype = 'host';
		o.rmempty = false;

		o = s.option(form.Value, 'username', _('Username'));
		o.placeholder = 'admin';

		o = s.option(form.Value, 'password', _('Password'));
		o.password = true;

		o = s.option(form.Flag, 'autosave', _('Save to flash after applying'),
			_('Off: a change that goes wrong is undone by power-cycling the switch.'));

		o = s.option(form.Flag, 'prune', _('Delete unlisted VLANs'),
			_('Remove VLANs from the switch that are not listed below (VLAN 1 is never removed).'));

		s = m.section(form.GridSection, 'vlan', _('VLANs'));
		s.addremove = true;
		s.anonymous = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'vid', _('VLAN ID'));
		o.datatype = 'range(1,4094)';
		o.rmempty = false;

		o = s.option(form.Value, 'name', _('Name'));
		o.datatype = 'maxlength(16)';

		o = s.option(form.MultiValue, 'untagged', _('Untagged ports'));
		portChoices(o);

		o = s.option(form.MultiValue, 'tagged', _('Tagged ports'));
		portChoices(o);

		s = m.section(form.GridSection, 'port', _('Ports'));
		s.anonymous = true;
		s.nodescriptions = true;

		o = s.option(form.DummyValue, 'port', _('Port'));

		o = s.option(form.Flag, 'enable', _('Enabled'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.ListValue, 'speed', _('Speed'));
		o.value('auto', _('Auto'));
		o.value('10h', '10M half');
		o.value('10f', '10M full');
		o.value('100h', '100M half');
		o.value('100f', '100M full');
		o.value('1000f', '1G full');
		o.value('2500f', '2.5G full');
		o.value('10gf', '10G full (port 9)');

		o = s.option(form.Flag, 'flow', _('Flow control'));
		o.rmempty = false;

		o = s.option(form.Value, 'pvid', _('PVID'));
		o.datatype = 'range(1,4094)';

		o = s.option(form.ListValue, 'accept', _('Accepted frames'));
		o.value('all', _('All'));
		o.value('tagged', _('Tagged only'));
		o.value('untagged', _('Untagged only'));

		return m.render();
	}
});
