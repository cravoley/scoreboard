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
							contentHub.getContent(contentId, true, function (err, resp) {
								content.matchesList[key] = resp;
								if (--contentToFetch <= 0) {
									callback.apply(this, [null, content]);
								}
							})
						});
					}
					return;
				} else
					return callback.apply(this, [null, content]);
			}
		}
		console.error("Unable to handle return ", content);
		callback.apply(this, [["Unable to handle return "+ content]]);
	},

	prepareContentForTransmission: function (content){
		if (content && content.contentId) {
			var newContent = {
				"contentId": content.contentId,
				"matches": content.matchesList,
				"lastUpdate": new Date().getTime()
			};
			return newContent;
		}
		return {};
	}
};

module.exports = footstats;
