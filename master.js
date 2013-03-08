var dgram = require('dgram');
var util = require('util');

var servers = require('./servers');

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

	this.servers = new servers.Servers({
		maxServersPerIP: this.options.MAX_SERVERS_PER_IP
	});

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
	MAX_SERVERS_PER_IP: 32,
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

exports.Master = Master;
