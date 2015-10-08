const Constants = require("../../../Constants");
const Events = Constants.Events;
const Endpoints = Constants.Endpoints;
const apiRequest = require("../../../core/ApiRequest");

module.exports = function(channelId) {
	return new Promise((rs, rj) => {
		apiRequest
		.post(Endpoints.TYPING(channelId))
		.auth(this.token)
		.end((err, res) => {
			if(!res.ok)
				return rj(err, res);

			//todo: do something? fire TYPING on setTimeout?
			rs();
		});
	});
}