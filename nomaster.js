var dgram = require('dgram');
var events = require('events');
var util = require('util');

/**
 * Represents one Odamex server.
 */
var Server = function(address, port, max_server_age) {
	this.address = address;
	this.port = port;
	this.max_server_age = max_server_age;
	this.verified = false;
	this.timeoutId = setTimeout(this.timeout.bind(this), max_server_age);
};
util.inherits(Server, events.EventEmitter);

/**
 * Resets the timeout, without any additional information.
 */
Server.prototype.heartbeat = function() {
	clearTimeout(this.timeoutId);
	this.timeoutId = setTimeout(this.timeout.bind(this), this.max_server_age);
};

/**
 * Resets the timeout, sets the verification bit on a server (which is used
 * to decide if a Server should actually show up on the master), and populates
 * the Server with additional information such as the server name and number of
 * players.
 */
Server.prototype.serverinfo = function() {
	this.heartbeat();
	this.verified = true;
	util.log("Server info not implemented");
};

/**
 * Server has gone too long without a heartbeat or a full update.
 */
Server.prototype.timeout = function() {
	this.emit('timeout');
};

/**
 * Returns the address of the server packed into 4 bytes.
 */
 Server.prototype.addressToBuffer = function() {
	var buffer = new Buffer(4);
	var octets = this.address.split('.');
	for (var i = 0;i < 4;i++) {
		buffer.writeUInt8(parseInt(octets[i], 10), i);
	}
	return buffer;
};

/**
 * Returns the port of the server packed as a 16-bit Little-Endian integer.
 */
Server.prototype.portToBuffer = function () {
	var buffer = new Buffer(2);
	buffer.writeInt16LE(this.port, 0);
	return buffer;
};

/**
 * Returns an IP address + port combined into one Buffer.
 */
Server.prototype.toBuffer = function() {
	return Buffer.concat([this.addressToBuffer(), this.portToBuffer()]);
};

/**
 * A datastructure that contains many Server objects.  The datastructure is
 * organized in such a way that makes it easier to group the servers by IP
 * address.  It also handles writing out a full server list message.
 */
var Servers = function() {
	this.servers = {};
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
		var server = new Server(address, port, max_server_age);
		server.on('timeout', this.deleteServer.bind(this, address, port));
		this.servers[address][port] = server;
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
	header.writeInt32LE(Master.prototype.LAUNCHER_CHALLENGE, 0);
	header.writeInt16LE(serverBuffers.length, 4);

	serverBuffers.unshift(header);
	return Buffer.concat(serverBuffers);
};

/**
 * Master is the main application object.  It makes sense of any options,
 * starts the appropriate servers, and stores the global Servers instance.
 */
var Master = function(options) {
	this.options = {};
	if (options) {
		for (var index in this.defaults) {
			this.options[index] = options[index] || this.defaults[index];
		}
	} else {
		this.options = this.defaults;
	}

	this.servers = new Servers();

	this.socket = dgram.createSocket('udp4');
	this.socket.on('message', this.message.bind(this));
	this.socket.bind(this.options.PORT);
};

/**
 * Packet identifiers.
 */
Master.prototype.SERVER_CHALLENGE = 5560020;
Master.prototype.LAUNCHER_CHALLENGE = 777123;

/**
 * Default options.
 * 
 * MAX_SERVER_AGE is the amount of time in milliseconds that  a Server is
 * allowed to live without a heartbeat or full update before it is
 * automatically removed from the master.  PORT is simply the port number that
 * the master listens on.
 */
Master.prototype.defaults = {
	MAX_SERVER_AGE: 300000,
	PORT: 15000
};

/**
 * Handles incoming messages.  Can either be a challenge from the server, a
 * full update from the server, or a challenge from the launcher.
 */
Master.prototype.message = function(msg, rinfo) {
	if (rinfo.size < 4) {
		return;
	}

	var challenge = msg.readInt32LE(0);

	switch (challenge) {
	case this.SERVER_CHALLENGE:
		if (rinfo.size > 6) {
			util.log("Full response not implemented");
		} else if (rinfo.size == 6) {
			this.servers.updateServer(rinfo.address, msg.readInt16LE(4), this.options.MAX_SERVER_AGE);
		} else {
			this.servers.updateServer(rinfo.address, rinfo.port, this.options.MAX_SERVER_AGE);
		}
		break;
	case this.LAUNCHER_CHALLENGE:
		if (rinfo.size > 4) {
			util.log("Master syncing server list (ignored), IP = " + rinfo.address);
			return;
		}

		util.log("Client request IP = " + rinfo.address);
		var message = this.servers.toBuffer();
		if (message.length > 576) {
			util.log("WARNING: Response is bigger than safe MTU");
		}
		this.socket.send(message, 0, message.length, rinfo.port, rinfo.address);
		break;
	}
};

if (require.main === module) {
	var master = new Master();
	util.log("Odamex Master Started");
}

exports.Server = Server;
exports.Servers = Servers;
exports.Master = Master;
