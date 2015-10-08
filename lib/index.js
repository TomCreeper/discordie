"use strict";

const events = require("events");
const request = require("./core/ApiRequest");
const DiscordieDispatcher = require("./core/DiscordieDispatcher");
const DiscordieError = require("./core/DiscordieError");
const Constants = require("./Constants");
const Events = Constants.Events;
const GatewaySocket = require("./networking/ws/GatewaySocket");
const Utils = require("./core/Utils");

const GuildCollection = require("./collections/GuildCollection");
const ChannelCollection = require("./collections/ChannelCollection");
const UserCollection = require("./collections/UserCollection");
const MessageCollection = require("./collections/MessageCollection");
const PresenceCollection = require("./collections/PresenceCollection");
const User = require("./models/User");
const AuthenticatedUser = require("./models/AuthenticatedUser");

const IGuildCollection = require("./interfaces/IGuildCollection");
const IChannelCollection = require("./interfaces/IChannelCollection");
const IAuthenticatedUser = require("./interfaces/IAuthenticatedUser");
const IUserCollection = require("./interfaces/IUserCollection");
const IMessageCollection = require("./interfaces/IMessageCollection");
const IDirectMessageChannelCollection = require("./interfaces/IDirectMessageChannelCollection");

const MessageHandlerCache = require("./core/MessageHandlerCache");
const messageHandlerCache = new WeakMap();

const rest = require("./networking/rest");

const defaultOptions = {
	//todo: game name support
	//gameNameSupport: true,
	multiThreadedVoice: false
};

function handleAuthLoginError(e) {
	this.pendingLogin = false;

	this.Dispatcher.emit(
		Events.DISCONNECTED,
		{error: new DiscordieError("Login failed", e.error)}
	);
}
function handleAuthLoginSuccess(e) {
	this.pendingLogin = false;
	this.token = e.token;
	this._password = e.password;
	delete e.token;
	delete e.password;

	rest(this).gateway();
}

function handleGatewayError(e) {
	this.pendingLogin = false;

	this.Dispatcher.emit(
		Events.DISCONNECTED,
		{error: new DiscordieError("Could not get gateway", e.error)}
	);
}
function handleGatewaySuccess(e) {
	this.pendingLogin = false;

	if(!this.gatewaySocket)
		this.gatewaySocket = new GatewaySocket(this);
	this.gatewaySocket.connect(e.gateway);
}

function registerVoiceEvents() {
	this.Dispatcher.on(Events.VOICE_SESSION_DESCRIPTION, e => {
		this.voiceConnections.push(e.socket);
	});
	this.Dispatcher.on(Events.VOICESOCKET_DISCONNECT, e => {
		this.voiceConnections =
			this.voiceConnections.filter((s) => s != e.socket);
	});
}

function registerGatewayHandlers() {
	this.Dispatcher.on(Events.GATEWAY_DISPATCH, e => {
		const handlers = messageHandlerCache.get(this);
		if(!handlers.processGatewayMessage(e.socket, e.type, e.data) && !e.handled) {
			return this.Dispatcher.emit(
				Events.GATEWAY_UNHANDLED_MESSAGE,
				{type: e.type, data: e.data}
			);
		}
		if(e.handled) delete e.handled;
	});

	const onVoiceMessage = (type, e) => {
		const handlers = messageHandlerCache.get(this);
		if(!handlers.processVoiceMessage(e.socket, type, e.data) && !e.handled) {
			return this.Dispatcher.emit(
				Events.VOICESOCKET_UNHANDLED_MESSAGE,
				{type: type, data: e.data}
			);
		}
		if(e.handled) delete e.handled;
	};

	this.Dispatcher.on(Events.VOICE_READY, e => {
		onVoiceMessage("READY", e);
	});
	this.Dispatcher.on(Events.VOICE_SESSION_DESCRIPTION, e => {
		onVoiceMessage("SESSION_DESCRIPTION", e);
	});
	this.Dispatcher.on(Events.VOICE_SPEAKING, e => {
		onVoiceMessage("SPEAKING", e);
	});
}

class Discordie {
	constructor(options) {
		messageHandlerCache.set(this, new MessageHandlerCache(this));

		if(!options) options = defaultOptions;
		this.options = options;
		Object.defineProperty(this, "options", {writable: false});
		// todo: support options for AudioScheduler

		this.Dispatcher = new DiscordieDispatcher();

		// todo: handle cleanup when voice connection drops
		this.voiceConnections = [];
		this.gatewaySocket = null;

		// todo: handle cleanup for secondary gateways on primary gw disconnect
		//this.Dispatcher.on(Events.DISCONNECTED, (e) => {
		//});

		// == PUBLIC == //

		this._user = new AuthenticatedUser();
		this._guilds = new GuildCollection(this, () => this.gatewaySocket);
		this._channels = new ChannelCollection(this, () => this.gatewaySocket);
		this._users = new UserCollection(this, () => this.gatewaySocket);
		this._presences = new PresenceCollection(this, () => this.gatewaySocket);
		this._messages = new MessageCollection(this, () => this.gatewaySocket);

		this.User = new IAuthenticatedUser(this);

		this.Guilds = new IGuildCollection(this,
			() => this._guilds.values());

		this.Channels = new IChannelCollection(this,
			() => this._channels.getGuildChannelIterator());

		this.Users = new IUserCollection(this,
			() => this._users.values());

		this.DirectMessageChannels = new IDirectMessageChannelCollection(this,
			() => this._channels.getPrivateChannelIterator());

		this.Messages = new IMessageCollection(this,
			() => this._messages.getIterator());

		this.joinVoice = function() {
			this.gatewaySocket.voiceStateUpdate.apply(this.gatewaySocket, arguments);
		};

		this.User = new IAuthenticatedUser(this);

		// == EVENTS == //

		this.Dispatcher.on(Events.REQUEST_AUTH_LOGIN_ERROR, handleAuthLoginError.bind(this));
		this.Dispatcher.on(Events.REQUEST_AUTH_LOGIN_SUCCESS, handleAuthLoginSuccess.bind(this));

		this.Dispatcher.on(Events.REQUEST_GATEWAY_ERROR, handleGatewayError.bind(this));
		this.Dispatcher.on(Events.REQUEST_GATEWAY_SUCCESS, handleGatewaySuccess.bind(this));

		// must register our gateway/voice events last to check e.handled

		registerGatewayHandlers.call(this);
		registerVoiceEvents.call(this);

		this._password = null;

		Utils.privatify(this);
	}

	get state() {
		if(this.pendingLogin)
			return Constants.DiscordieState.LOGGING_IN;

		if(this.token)
			return Constants.DiscordieState.LOGGED_IN;

		if(this.gatewaySocket) {
			if(this.gatewaySocket.connected)
				return Constants.DiscordieState.CONNECTED;
			if(this.gatewaySocket.connecting)
				return Constants.DiscordieState.CONNECTING;
		}

		return Constants.DiscordieState.DISCONNECTED;
	}
	connect(credentials, forceNewSession) {
		if(this.state == Constants.DiscordieState.CONNECTED
			|| this.state == Constants.DiscordieState.CONNECTING
			|| this.pendingLogin)
			return;

		if(forceNewSession) this.gatewaySocket = null;

		this.pendingLogin = true;

		if(this.token) {
			rest(this).gateway();
			return;
		}

		rest(this).auth.login(credentials);
	}
}

// add ctrl+c signal handling to disconnect from voice properly

Discordie.Events = Events;

module.exports = Discordie;