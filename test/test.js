var assert = require('assert');
var dgram = require('dgram');

var server = require('../server');
var servers = require('../servers');
var master = require('../master');

describe('Server', function() {
	describe('#addressToBuffer()', function() {
		it('should output an IP address as a packed buffer', function() {
			var s = new server.Server('127.0.0.1', 10666, 300000);
			assert.strictEqual(s.addressToBuffer().toString('hex'), '7f000001');
		});
	});
	describe('#portToBuffer()', function() {
		it('should output a port as a packed buffer', function() {
			var s = new server.Server('127.0.0.1', 10666, 300000);
			assert.strictEqual(s.portToBuffer().toString('hex'), 'aa29');
		});
	});
	describe('#toBuffer()', function() {
		it('should output an IP address and port as a packed buffer', function() {
			var s = new server.Server('127.0.0.1', 10666, 300000);
			assert.strictEqual(s.toBuffer().toString('hex'), '7f000001aa29');
		});
	});
});

describe('Servers', function() {
	describe('#updateServer()', function() {
		it('should not overrun the maximum amount of servers per IP setting', function() {
			var s = new servers.Servers({
				maxServersPerIP: 2
			});
			for (var i = 0;i < 3;i++) {
				s.updateServer('127.0.0.1', 10666 + i, 1000);
			}
			assert.strictEqual(Object.keys(s.servers['127.0.0.1']).length, 2);
		});
	});
});

describe('Master', function() {
	describe('#message()', function() {
		var rinfo = {
			address: '127.0.0.1',
			family: 'IPv4',
			port: 10000,
			size: 1
		};
		it('should correctly handle a lack of servers on the master', function(done) {
			var m = new master.Master();

			var client = dgram.createSocket('udp4', function(msg, rinfo) {
				if (rinfo.port !== 15000) {
					return;
				}
				assert.strictEqual(msg.toString('hex'), 'a3db0b000000');
				done();
			});
			client.bind(10000);

			var message = new Buffer(4);
			message.writeInt32LE(m.LAUNCHER_CHALLENGE, 0);
			client.send(message, 0, message.length, master.Master.prototype.defaults.PORT, 'localhost');
		});
		it('should not die if you fuzz the port with a single-byte message', function() {
			var m = new master.Master();

			var message = new Buffer(1);
			message[0] = 0xff;

			assert.doesNotThrow(function() {
				m.message(message, rinfo);
			});
		});
		it('should not die if you fuzz the port with an incomplete SERVER_CHALLENGE', function() {
			var m = new master.Master();

			var message = new Buffer(5);
			message.writeInt32LE(m.SERVER_CHALLENGE, 0);
			message[4] = 0xff;

			assert.doesNotThrow(function() {
				m.message(message, rinfo);
			});
		});
		it('should not die if you fuzz the port with an malformed LAUNCHER_CHALLENGE', function() {
			var m = new master.Master();

			var message = new Buffer(5);
			message.writeInt32LE(m.LAUNCHER_CHALLENGE, 0);
			message[4] = 0xff;

			assert.doesNotThrow(function() {
				m.message(message, rinfo);
			});
		});
	});
});
