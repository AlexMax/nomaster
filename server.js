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

exports.Server = Server;
