# Discordie

A Node.js module providing a set of interfaces to interact with Discord API.

**Requires at least Node.js 4.0.0.**

Join [#node_discordie](https://discord.gg/0SBTUU1wZTWO5NWd) in [Discord API](https://discord.gg/0SBTUU1wZTWO5NWd).

## Fully Implemented

* Messaging
* Role and channel permission management API
* Member management API (kicking, banning, etc.)
* Direct messages
* Voice encoding, sending, decoding and receiving
(audio streaming example: [`examples/massive.js`](https://github.com/qeled/discordie/blob/master/examples/massive.js))
* Guild (server) and channel management API
* Local user profile (username change, statuses, avatars)
* Multiserver voice support

## Planned

* Stream interfaces

## Documentation

Currently only inline documentation in files:
* `lib/interfaces/*.js`
* `lib/models/*.js`
* `lib/index.js`

## Example

```js
var Discordie = require("discordie");
var Events = Discordie.Events;

var client = new Discordie();

client.connect({
  email: "discordie@example.com",
  password: ""
});

client.Dispatcher.on(Events.GATEWAY_READY, e => {
  console.log("Connected as: " + client.User.username);
});

client.Dispatcher.on(Events.MESSAGE_CREATE, e => {
  if (e.message.content == "ping")
    e.message.channel.sendMessage("pong");
});
```

## Related

**.NET**:
[RogueException/**Discord.Net**](https://github.com/RogueException/Discord.Net) ||
[Luigifan/**DiscordSharp**](https://github.com/Luigifan/DiscordSharp)

**Node.js**:
[izy521/**discord.io**](https://github.com/izy521/discord.io) ||
[hydrabolt/**discord.js**](https://github.com/hydrabolt/discord.js)

**Python**:
[Rapptz/**discord.py**](https://github.com/Rapptz/discord.py)

**Ruby**:
[meew0/**discordrb**](https://github.com/meew0/discordrb)

**Go**:
[bwmarrin/**discordgo**](https://github.com/bwmarrin/discordgo) ||
[gdraynz/**go-discord**](https://github.com/gdraynz/go-discord) ||
[Xackery/**discord**](https://github.com/Xackery/discord)

**Rust**:
[SpaceManiac/**discord-rs**](https://github.com/SpaceManiac/discord-rs)

**PHP**:
[teamreflex/**DiscordPHP**](https://github.com/teamreflex/DiscordPHP) ||
[Cleanse/**discord-hypertext**](https://github.com/Cleanse/discord-hypertext)

**Scala**:
[eaceaser/**discord-akka**](https://github.com/eaceaser/discord-akka)

**Java**:
[nerd/**Discord4J**](https://github.com/nerd/Discord4J)




## TODO

* Stream interfaces for voice
* Avatar/icon uploading
* Partial object diffs on some events (?)
* Account creation (?)
* WebRTC transport implementation (?)

