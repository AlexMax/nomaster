var util = require('util');

var master = require('./master');
var server = require('./server');

/**
 * A datastructure that contains many Server objects.  The datastructure is
 * organized in such a way that makes it easier to group the servers by IP
 * address.  It also handles writing out a full server list message.
 */
var Servers = function(options) {
	this.servers = {};
	this.maxServersPerIP = options.maxServersPerIP || 65536;
};

/**
 * Adds or updates a server, depending on if the Server exists in the
 * object or not.
 */
Servers.prototype.updateServer = function(address, port, max_server_age) {
	if (!(address in this.servers)) {
		this.servers[address] = {};
	}

	if (!(port in this.servers[address])) {
		// Don't add a server if we run into the maximum servers per IP
		var numServers = Object.keys(this.servers[address]).length;
		if (numServers >= this.maxServersPerIP) {
			return;
		}

		var s = new server.Server(address, port, max_server_age);
		s.on('timeout', this.deleteServer.bind(this, address, port));
		this.servers[address][port] = s;
		util.log('Added new server: ' + address + ':' + port);
	} else {
		this.servers[address][port].heartbeat();
		util.log('Server sent heartbeat: ' + address + ':' + port);
	}
};

/**
 * Delete a Server.
 */
Servers.prototype.deleteServer = function(address, port) {
	delete this.servers[address][port];
	util.log('Remote server timed out: ' + address + ':' + port);
};

/**
 * Returns a complete launcher challenge message containing a list of servers
 * in a simple packed buffer format.
 *
 * The format is quite simple.  There is a 6 byte header containing a 4 byte
 * magic number and a 2 byte count of the servers in the message.  Then, every
 * individual server is written into the message using their IP+Port buffer
 * representation.
 */
Servers.prototype.toBuffer = function () {
	var serverBuffers = [];

	for (var address in this.servers) {
		var length = this.servers[address].length;
		if (length === 0) {
			continue;
		}
		for (var server in this.servers[address]) {
			serverBuffers.push(this.servers[address][server].toBuffer());
		}
	}

	var header = new Buffer(6);
	header.writeInt32LE(master.Master.prototype.LAUNCHER_CHALLENGE, 0);
	header.writeInt16LE(serverBuffers.length, 4);

	serverBuffers.unshift(header);
	return Buffer.concat(serverBuffers);
};

Servers.prototype.toCompressedBuffer = function() {
	var serverBuffers = [];

	for (var address in this.servers) {
		var length = Object.keys(this.servers[address]).length;
		if (!length) {
			continue;
		}

		var buffer = new Buffer(6 + (length * 2));
		var addrBuffer = null;

		var ports = [];
		for (var server in this.servers[address]) {
			if (addrBuffer === null) {
				addrBuffer = this.servers[address][server].addressToBuffer();
			}
			ports.push(this.servers[address][server].portToBuffer());
		}

		buffer.writeUInt16LE(length, 0);
		addrBuffer.copy(buffer, 2);
		Buffer.concat(ports).copy(buffer, 6);

		serverBuffers.push(buffer);
	}

	return Buffer.concat(serverBuffers);
}

exports.Servers = Servers;
