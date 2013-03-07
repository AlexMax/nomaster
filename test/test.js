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
