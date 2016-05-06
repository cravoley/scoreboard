var fs = require("fs");
var config = require("../config");
var xml2js = require('xml2js');
var request = require('request');

var lastEvent = 0;
var lastEventFile = config.cacheDir + "lastEvent.id";
var authToken;
function ContentHub() {
	var contentHubApi = this;
	var updateLastEvent = function (nextEvent) {
		lastEvent = nextEvent;
		fs.writeFileSync(lastEventFile, lastEvent);
	};
	// private auth method
	var authInternal = function (callback) {
		contentHubApi.auth(config.username, config.password, callback);
	};
	this.checkChanges = function (delay, callback) {
		var checkChangesWebservice = function () {
			var contentHub = config.contentHub;
			var url = contentHub.protocol
				.concat(":")
				.concat("//")
				.concat(contentHub.hostname)
				.concat(":")
				.concat(contentHub.port)
				.concat(contentHub.path)
				.concat(contentHub.changes)
				.concat("?format=xml")
				.concat("&since=")
				.concat(lastEvent);
			request(url, function (error, response, body) {
				// prepare for next exectution
				setTimeout(checkChangesWebservice, delay);
				if (error) return console.log("Unable to handle request to URL ", url, error);
				xml2js.parseString(body, function (err, result) {
					if (err) console.log("Unable to convert XML to json", err);
					// handle response
					callback.apply(this, [null, result, body, response]);
					if (result) {
						if (result.changelist) {
							if (result.changelist.next)
								updateLastEvent(result.changelist.next[0]);
						}
					}
				});
			});
		};
		try {
			lastEvent = fs.readFileSync(lastEventFile);
			if (!lastEvent || lastEvent == "undefined")
				lastEvent = 0;
		} catch (err) {
			console.info("Starting with a empty event");
			lastEvent = 0;
		}
		// start "loop"
		checkChangesWebservice();
	};

	this.auth = function (username, password, callback) {
		console.log("Auth user");
		var contentHub = config.contentHub;
		var url = contentHub.protocol
			.concat(":")
			.concat("//")
			.concat(contentHub.hostname)
			.concat(":")
			.concat(contentHub.port)
			.concat(contentHub.path)
			.concat(contentHub.auth)
		var options = {
			uri: url,
			method: 'POST',
			json: {
				"username": username,
				"password": password
			}
		};
		request.post(options, function (error, response, body) {
				if (body.token) {
					authToken = body.token;
				} else
					console.log(body);
				if (callback) {
					callback.apply(this, []);
				}
			}
		);
		//
	};
	/**
	 *
	 * @param contentId contentId to retrieve the content
	 * @param fromCache should retrieve cached content
	 * @param callback function (content, body, response);
	 */
	this.getContent = function (contentId, fromCache, callback) {
		var cacheFile = config.cacheDir + contentId + ".id";
		// allow call with 2 parameters
		if (typeof fromCache == "function") return this.getContent(contentId, false, fromCache);
		var getContentFromCache = function () {
			fs.readFile(cacheFile, 'utf8', function (err, content) {
				if (err || content == "undefined") {
					fromCache = false;
					return getContentInternal(false);
				}
				try {
					content = JSON.parse(content);
				} catch (err) {
					console.log("Unable to parse JSON from file " + cacheFile, err);
					fromCache = false;
					return getContentInternal(false);
				}
				callback.apply(this, [null, content]);
			})
		};

		function getContentInternal(isRetry) {
			if (fromCache) return getContentFromCache();
			if (authToken == "undefined" && !isRetry) return authInternal(getContentInternal(true));
			if (Array.isArray(contentId)) {
				contentId.forEach(function (item) {
					contentHubApi.getContent(item, callback)
				});
			} else {
				var contentHub = config.contentHub;
				var url = contentHub.protocol
					.concat(":")
					.concat("//")
					.concat(contentHub.hostname)
					.concat(":")
					.concat(contentHub.port)
					.concat(contentHub.path)
					.concat(contentHub.content)
					.concat("contentid/")
					.concat(contentId)
					.concat("?format=json")
					.concat("&variant=scoreBoard");
				var options = {
					uri: url,
					method: 'GET',
					headers: {
						"X-Auth-Token": authToken
					}
				};
				request(options, function (error, response, body) {
					if (error) throw error;

					try {
						var content = JSON.parse(body);
					} catch (err) {
						console.log("Unable to parse json", body, err);
					}
					if (content && content.statusCode && !isRetry) {
						var statusCode = content.statusCode;
						if ("40100" == statusCode || "40300" == statusCode) {
							contentHubApi.auth(config.username, config.password, function () {
								getContentInternal(true);
							});
							return;
						}
					}

					fs.writeFile(cacheFile, body, function (err) {
						if (err) {
							console.log("Unable to save cache file " + cacheFile, err);
						}
					});

					callback.apply(this, [null, content, body, response]);


					/*xml2js.parseString(body, function (err, result) {
					 if (err) throw err;
					 // if we have an auth error and this is not a retry (after trying to login), try to login and redo the same operation
					 if (result.error && result.error.statusCode && !isRetry) {
					 var statusCode = result.error.statusCode;
					 if ("40100" == statusCode || "40300" == statusCode) {
					 contentHubApi.auth(config.username, config.password, function () {
					 getContentInternal(true);
					 });

					 }
					 } else {
					 var callbackContent = {};
					 if (result && result.content && result.content.contentData && result.content.contentData.length > 0) {
					 var content = result.content.contentData[0];
					 if (content.model && content.model.length > 0) {
					 content = content.model[0];
					 if (content['$'] && content['$'].typeName)
					 callbackContent.inputTemplate = content['$'].typeName;
					 callbackContent.content = content;
					 }
					 }
					 console.log(JSON.stringify(content));
					 fs.writeFile(cacheFile, JSON.stringify(content), function (err) {
					 if (err) {
					 console.log("Unable to save cache file " + cacheFile, err);
					 }
					 });
					 callback.apply(this, [callbackContent, result, response]);
					 }
					 });*/
				});
			}
		}

		getContentInternal(false);
	};
}

module.exports = new ContentHub();
