var twilio = require('twilio')

module.exports.login = function (req, res) {


	console.log('agents login');

	var client = new twilio.TaskRouterClient(
		process.env.TWILIO_ACCOUNT_SID,
		process.env.TWILIO_AUTH_TOKEN,
		process.env.TWILIO_WORKSPACE_SID
	)

	var friendlyName = req.body.worker.friendlyName

	/* all token we generate are valid for 1 hour */
	var lifetime = 3600

	client.workspace.workers.get(function (error, data) {

		if (error) {
			res.status(500).json(error)
			return
		}

		for (var i = 0; i < data.workers.length; i++) {

			var worker = data.workers[i]

			if (worker.friendlyName === friendlyName) {

				/* create a token for taskrouter */
				var workerCapability = new twilio.TaskRouterWorkerCapability(
					process.env.TWILIO_ACCOUNT_SID,
					process.env.TWILIO_AUTH_TOKEN,
					process.env.TWILIO_WORKSPACE_SID, worker.sid
				)

				workerCapability.allowActivityUpdates()
				workerCapability.allowReservationUpdates()
				workerCapability.allowFetchSubresources()

				/* create a token for Twilio client */
				var phoneCapability = new twilio.Capability(
					process.env.TWILIO_ACCOUNT_SID,
					process.env.TWILIO_AUTH_TOKEN
				)


				phoneCapability.allowClientOutgoing(req.configuration.twilio.applicationSid)
				phoneCapability.allowClientIncoming(friendlyName.toLowerCase())

				/* create token for Twilio IP Messaging */
				var grant = new twilio.AccessToken.IpMessagingGrant({
					serviceSid: process.env.TWILIO_IPM_SERVICE_SID,
					endpointId: req.body.endpoint
				})

				var accessToken = new twilio.AccessToken(
					process.env.TWILIO_ACCOUNT_SID,
					process.env.TWILIO_API_KEY,
					process.env.TWILIO_API_SECRET,
					{ ttl: lifetime }
				)

				accessToken.addGrant(grant)
				accessToken.identity = worker.friendlyName

				var tokens = {
					worker: workerCapability.generate(lifetime),
					phone: phoneCapability.generate(lifetime),
					chat: accessToken.toJwt()
				}

				req.session.tokens = tokens
				req.session.worker = worker

				res.status(200).end()
				return

			}

		}

		res.status(404).end()
		return

	})

}

module.exports.logout = function (req, res) {

	req.session.destroy(function (err) {
		if (err) {
			res.status(500).json(err)
		} else {
			res.status(200).end()
		}
	})

}

module.exports.getSession = function (req, res) {

	console.log('agenst getSesssion');

	if (!req.session.worker) {
		res.status(403).end()
	} else {
		res.status(200).json({
			tokens: req.session.tokens,
			worker: req.session.worker,
			configuration: {
				twilio: req.configuration.twilio
			}
		})
	}

};

module.exports.call = function (req, res) {

	var client = new twilio(
		process.env.TWILIO_ACCOUNT_SID,
		process.env.TWILIO_AUTH_TOKEN,
		process.env.TWILIO_WORKSPACE_SID
	);

	console.log('call');

	var twiml = new twilio.TwimlResponse();

	console.log('trycalling', req.query.phone);
	// twiml.dial({ callerId: req.configuration.twilio.callerId }, function (node) {
	// 	node.number(req.query.phone)
	// })


	var conferenceId = Math.floor((Math.random() * 1000000) + 1);

	// here is new stuff i added for conference
	var call = client.calls.create({
		from: "+31858889347",
		to: req.query.phone,
		url: "https://2067e366.ngrok.io/api/agents/join_conference?conferenceId=" + conferenceId
	});

	console.log('call', call);

	// Now return TwiML to the caller to put them in the conference, using the
	// same name.
	twiml.dial(function(node) {
		node.conference("" + conferenceId, {
			waitUrl: "http://twimlets.com/holdmusic?Bucket=com.twilio.music.rock",
			startConferenceOnEnter: false
		});
	});
//	res.set('Content-Type', 'text/xml');
	// conference stuff to heree

	res.setHeader('Content-Type', 'application/xml');
	res.setHeader('Cache-Control', 'public, max-age=0');
	res.send(twiml.toString());

};


module.exports.joinConference = function (req, res) {

	var twiml = new twilio.TwimlResponse();

	// Now return TwiML to the caller to put them in the conference, using the
	// same name.
	twiml.dial(function(node) {
		node.conference(req.query.conferenceId, {
			startConferenceOnEnter: true
		});

	});
//	res.set('Content-Type', 'text/xml');
	// conference stuff to heree

	res.setHeader('Content-Type', 'application/xml');
	res.setHeader('Cache-Control', 'public, max-age=0');
	res.send(twiml.toString());

};
