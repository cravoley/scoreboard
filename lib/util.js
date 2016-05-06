var util = {
	/**
	 * Remove unnecessary content from return object based on type
	 * @param dirtyContent
	 * @param type
	 * @param callback
	 */
	clearContent: function (dirtyContent, type, callback) {
		var cleanContent;
		if (type == "scoreboard") {
			cleanContent = {
				"matches": []
			};
			if (dirtyContent.matches) {
				dirtyContent.matches.forEach(function (match) {
					util.clearContent(match, "match", function (mClean) {
						cleanContent.matches.push(mClean);
					});
				})
			}
		} else if (type == "match") {
			// create an empty content
			cleanContent = {
				"id": "",
				"homeTeam": "",
				"homeTeamLogo": "",
				"homeScore": "",
				"homeScorePenalty": "",
				"awayTeam": "",
				"awayTeamLogo": "",
				"awayScore": "",
				"awayScorePenalty": "",
				"stadium": "",
				"status": ""
			}
			if (dirtyContent.contentData) {
				dirtyContent = dirtyContent.contentData;
			}
			cleanContent.id = dirtyContent.contentId;
			cleanContent.status = dirtyContent.status;
			cleanContent.stadium = dirtyContent.stadium;
			cleanContent.homeTeam = dirtyContent.homeTeam;
			cleanContent.homeTeamLogo = dirtyContent.homeTeamLogo;
			cleanContent.homeScore = dirtyContent.homeScore;
			cleanContent.homeScorePenalty = dirtyContent.homeScorePenalty;
			cleanContent.awayTeam = dirtyContent.awayTeam;
			cleanContent.awayTeamLogo = dirtyContent.awayTeamLogo;
			cleanContent.awayScore = dirtyContent.awayScore;
			cleanContent.awayScorePenalty = dirtyContent.awayScorePenalty;

		}
		callback.apply(this, [cleanContent]);
	}
};

module.exports = util;
