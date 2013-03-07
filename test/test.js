var assert = require('assert');

var nomaster = require('../nomaster');

describe('Server', function() {
	describe('#addressToBuffer()', function() {
		it('should output an IP address as a packed buffer', function() {
			var server = new nomaster.Server('127.0.0.1', 10666, 300000);
			assert.strictEqual(server.addressToBuffer().toString('hex'), '7f000001');
		});
	});
	describe('#portToBuffer()', function() {
		it('should output a port as a packed buffer', function() {
			var server = new nomaster.Server('127.0.0.1', 10666, 300000);
			assert.strictEqual(server.portToBuffer().toString('hex'), 'aa29');
		});
	});
	describe('#toBuffer()', function() {
		it('should output an IP address and port as a packed buffer', function() {
			var server = new nomaster.Server('127.0.0.1', 10666, 300000);
			assert.strictEqual(server.toBuffer().toString('hex'), '7f000001aa29');
		});
	});
});

describe('Master', function() {
	var rinfo = {
		address: '127.0.0.1',
		family: 'IPv4',
		port: 10000,
		size: 1
	};
	it('should not die if you fuzz the port with a single-byte message', function() {
		var master = new nomaster.Master();

		var message = new Buffer(1);
		message[0] = 0xff;

		assert.doesNotThrow(function() {
			master.message(message, rinfo);
		});
	});
	it('should not die if you fuzz the port with an incomplete SERVER_CHALLENGE', function() {
		var master = new nomaster.Master();

		var message = new Buffer(5);
		message.writeInt32LE(nomaster.Master.prototype.SERVER_CHALLENGE, 0);
		message[4] = 0xff;

		assert.doesNotThrow(function() {
			master.message(message, rinfo);
		});
	});
	it('should not die if you fuzz the port with an malformed LAUNCHER_CHALLENGE', function() {
		var master = new nomaster.Master();

		var message = new Buffer(5);
		message.writeInt32LE(nomaster.Master.prototype.LAUNCHER_CHALLENGE, 0);
		message[4] = 0xff;

		assert.doesNotThrow(function() {
			master.message(message, rinfo);
		});
	});
});
