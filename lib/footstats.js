var contentHub = require("../bin/contenthub");


var footstats = {
	handleAndParseContentHubReturn: function (content, callback) {
		if (content) {
			if (content.contentData) {
				content = content.contentData;
				// the whole score board has been updated
				if (content._type == "br.com.hed.third.party.service.footstats.match.scoreBoard.match.ScoreBoardModelMapping$ScoreBoardModel") {
					if (Array.isArray(content.matchesList)) {
						var contentToFetch = content.matchesList.length;
						//console.log(content);
						content.matchesList.forEach(function (match, key) {
							var contentId = match.replace("contentid/", "");
							contentHub.getContent(contentId, true, function (resp) {
								content.matchesList[key] = resp;
								if (--contentToFetch <= 0) {
									callback.apply(this, [content]);
								}
							})
						});
					}
					return;
				} else
					return callback.apply(this, [content]);
			}
		}
		console.error("Unable to handle return ", content);
		callback.apply(this, [[]]);
	}
};

module.exports = footstats;