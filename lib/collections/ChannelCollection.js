"use strict";

const Constants = require("../Constants");
const Events = Constants.Events;
const ChannelTypes = Constants.ChannelTypes;
const Utils = require("../core/Utils");
const BaseCollection = require("./BaseCollection");

const Channel = require("../models/Channel");

function createChannel(channel) {
	return new Channel({
		id: channel.id,
		name: channel.name || "",
		topic: channel.topic || "",
		position: channel.position || 0,
		recipient_id: channel.is_private ? channel.recipient.id : null,
		type: channel.type || ChannelTypes.TEXT,
		guild_id: channel.guild_id,
		is_private: channel.is_private,
		permission_overwrites: channel.permission_overwrites
	});
}

function handleConnectionOpen(data) {
	this.clear();
	data.guilds.forEach(guild => {
		if (guild.unavailable) return;
		guild.channels.forEach(channel => {
			channel.guild_id = guild.id;
			this.set(channel.id, createChannel(channel));
		});
	});
	data.private_channels.forEach(channel => {
		this.set(channel.id, createChannel(channel));
	});
	return true;
}

function handleCreateOrUpdateChannel(channel) {
	this.mergeOrSet(channel.id, createChannel(channel));
	return true;
}

function handleDeleteChannel(channel) {
	this.delete(channel.id);
	return true;
}

function handleCreateGuild(guild) {
	guild.channels.forEach(channel => {
		this.set(channel.id, createChannel(channel));
	});
	return true;
}

function handleGuildDelete(guild) {
	this.forEach((channel, id) => {
		if (channel.guild_id == guild.id)
			this.delete(id);
	});
	return true;
}

class ChannelCollection extends BaseCollection {
	constructor(discordie, gateway) {
		super();

		if (typeof gateway !== "function")
			throw new Error("Gateway parameter must be a function");

		discordie.Dispatcher.on(Events.GATEWAY_READY, e => {
			if (e.socket != gateway()) return;
			(handleConnectionOpen.bind(this))(e.data);
		});
		discordie.Dispatcher.on(Events.GATEWAY_DISPATCH, e => {
			if (e.socket != gateway()) return;

			Utils.bindGatewayEventHandlers(this, e, {
				GUILD_CREATE: handleCreateGuild,
				GUILD_DELETE: handleGuildDelete,
				CHANNEL_CREATE: handleCreateOrUpdateChannel,
				CHANNEL_UPDATE: handleCreateOrUpdateChannel,
				CHANNEL_DELETE: handleDeleteChannel
			});
		});

		this._discordie = discordie;
		Utils.privatify(this);
	}
	*getPrivateChannelIterator() {
		for (let channel of this.values()) {
			if (channel.is_private)
				yield channel;
		}
	}
	*getGuildChannelIterator() {
		for (let channel of this.values()) {
			if (!channel.is_private)
				yield channel;
		}
	}
	isPrivate(channelId) {
		const channel = this._discordie._channels.get(channelId);
		if(channel) return channel.is_private;
		return null;
	}
	getChannelType(channelId) {
		const channel = this._discordie._channels.get(channelId);
		if(channel) return channel.type;
		return null;
	}
}

module.exports = ChannelCollection;