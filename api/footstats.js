function Footstats(contentHub) {
	var contentHubApi = contentHub;
	this.updateScoreBoard = function (content, callback, contentParser) {
		var callbackObj = {};
		var matches = content.content.matches;
		if (matches && matches.length > 0) {
			var matchList = matches[0].list;
			if (matchList && matchList.length > 0) {
				matchList = matchList[0];
				// has matches
				if (matchList.item && matchList.item.length > 0) {
					var amountOfMatches = matchList.item.length;
					callbackObj.matches = [];
					matchList.item.forEach(function (item) {
						if (item.contentId && item.contentId[0]) {
							// value got from webservice return
							var contentId = item.contentId[0]._;
							contentId = contentId.replace("contentid/", "");
							// get matches content (from cache if possible). The cached content will be updated by another process when it has changed. We don't have to worry about it here
							contentHubApi.getContent(contentId, true, function (content) {
								--amountOfMatches;
								if (typeof contentParser == "function") {
									callbackObj.matches.push(contentParser.call(this, content));
								} else
									callbackObj.matches.push(content);
								// all matches has been retrieved either from cache or from content hub
								if (amountOfMatches == 0)
									callback.apply(this, [callbackObj]);
							});
						}
					});

				}
			}
		}
	};
	this.updateMatch = function (content, callback, contentParser) {
		console.log("Update matches")
		console.log(content);
	};
};


/*

 }
 }
 console.dir(content.content.matches[0].list[0]);
 */

module.exports = function (contentHub) {
	return new Footstats(contentHub);
};