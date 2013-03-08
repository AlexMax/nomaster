var master = require('./master');
var util = require('util');

if (require.main === module) {
	var m = new master.Master();
	util.log("Odamex Master Started");
}
