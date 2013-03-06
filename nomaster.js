var dgram = require('dgram');
var events = require('events');
var util = require('util');

var SERVER_CHALLENGE = 5560020;
var LAUNCHER_CHALLENGE = 777123;

var Server = function(address, port, max_server_age) {
	this.address = address;
	this.port = port;
	this.max_server_age = max_server_age;
	this.verified = false;
	this.timeoutId = setTimeout(this.timeout.bind(this), max_server_age);
};
util.inherits(Server, events.EventEmitter);
Server.prototype.heartbeat = function() {
	clearTimeout(this.timeoutId);
	this.timeoutId = setTimeout(this.timeout.bind(this), this.max_server_age);
};
Server.prototype.serverinfo = function() {
	this.heartbeat();
	this.verified = true;
	util.log("Server info not implemented");
};
Server.prototype.timeout = function() {
	this.emit('timeout');
};
Server.prototype.toBuffer = function() {
	var buffer = new Buffer(6);
	var octets = this.address.split('.');
	for (var i = 0;i < 4;i++) {
		buffer.writeUInt8(parseInt(octets[0], 10), 0);
		buffer.writeUInt8(parseInt(octets[1], 10), 1);
		buffer.writeUInt8(parseInt(octets[2], 10), 2);
		buffer.writeUInt8(parseInt(octets[3], 10), 3);
	}
	buffer.writeInt16LE(this.port, 4);
	return buffer;
};

var Servers = function() {
	this.servers = {};
};
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
Servers.prototype.deleteServer = function(address, port) {
	delete this.servers[address][port];
	util.log('Remote server timed out: ' + address + ':' + port);
};
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

	header = new Buffer(6);
	header.writeInt32LE(LAUNCHER_CHALLENGE, 0);
	header.writeInt16LE(serverBuffers.length, 4);

	serverBuffers.unshift(header);
	return Buffer.concat(serverBuffers);
};

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
Master.prototype.defaults = {
	MAX_SERVER_AGE: 300000,
	PORT: 15000
};
Master.prototype.message = function(msg, rinfo) {
	var challenge = msg.readInt32LE(0);

	switch (challenge) {
	case SERVER_CHALLENGE:
		if (rinfo.size > 6) {
			util.log("Full response not implemented");
		} else if (rinfo.size == 6) {
			this.servers.updateServer(rinfo.address, msg.readInt16LE(4), this.options.MAX_SERVER_AGE);
		} else {
			this.servers.updateServer(rinfo.address, rinfo.port, this.options.MAX_SERVER_AGE);
		}
		break;
	case LAUNCHER_CHALLENGE:
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
