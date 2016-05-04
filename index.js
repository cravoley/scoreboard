var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	path = require('path'),
	config = require("./config");
var mkpath = require('mkpath');
var fs = require("fs");
mkpath.sync(config.cacheDir);


var nsp = io.of("/livescore");
//io.set('origins', config.origins);



/**
 * Remove unnecessary content from return object based on type
 * @param dirtyContent
 * @param type
 * @param callback
 */
function clearContent(dirtyContent, type, callback) {
	var cleanContent;
	if (type == "scoreboard") {
		cleanContent = {
			"matches": []
		};
		if (dirtyContent.matches) {
			dirtyContent.matches.forEach(function (match) {
				clearContent(match, "match", function (mClean) {
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

nsp.on('connection', function (socket) {
	var liveScoreId = socket.handshake.query.id;
	if (!liveScoreId || liveScoreId == "undefined") return;
	console.log("connected", liveScoreId);
	socket.join(liveScoreId);
	getScoreboardContent(liveScoreId, function (content) {
		clearContent(content, "scoreboard", function (c) {
			socket.emit("scoreboard", c);
		});
	});
	socket.on('disconnect', function () {
		//console.log('user disconnected');
	});
});
var contentHub = require("./bin/contenthub");
var scoreBoardsAndMatches = [];


function getScoreboardContent(scoreBoardId, callback) {
	var found = false;
	scoreBoardsAndMatches.forEach(function (board, key) {
		if (board.contentId == scoreBoardId) {
			found = true;
			callback.apply(this, [board]);
			return;
		}
	});
	contentHub.getContent(scoreBoardId, true, function (content) {
		handleAndParseContentHubReturn(content, function (content) {
			var contentToEmit = updateScoreBoardsAndMatches(content);
			callback.apply(this, [contentToEmit]);
		});
	});
}

function updateScoreBoardsAndMatches(content) {
	if (content && content.contentId) {
		var newContent = {
			"contentId": content.contentId,
			"matches": content.matchesList,
			"lastUpdate": new Date().getTime()
		};
		var found = false;
		scoreBoardsAndMatches.forEach(function (board, key) {
			if (board.contentId == content.contentId) {
				found = key;
				return;
			}
		});
		if (found === false) {
			scoreBoardsAndMatches.push(newContent);
		} else {
			scoreBoardsAndMatches[found] = newContent;
		}
		return newContent;
	}
}

function propagateUpdates(updatedContent) {
	//console.log("PO",updatedContent);
	// the full board has been updated
	if (updatedContent._type == "br.com.hed.third.party.service.footstats.match.scoreBoard.match.ScoreBoardModelMapping$ScoreBoardModel") {
		var contentToPropagate = updateScoreBoardsAndMatches(updatedContent);
		clearContent(contentToPropagate, "scoreboard", function (c) {
			//console.log("Sending update to ",updatedContent.contentId, c);
			nsp.to(updatedContent.contentId).emit("scoreboard", c);
		});
	} else if (updatedContent._type == "br.com.hed.third.party.service.footstats.match.scoreBoard.match.ScoreBoardMatchModelMapping$MatchBean") {
		//console.log("T", updatedContent, scoreBoardsAndMatches )
		if (updatedContent.contentId) {
			// Search scoreBoards where this match is referenced
			if (scoreBoardsAndMatches) {
				scoreBoardsAndMatches.forEach(function (board, key) {
					if (board.matches != "undefined" && board.matches.length > 0) {
						board.matches.forEach(function (match, key) {
							//console.log(match.id ,match.id == updatedContent.contentId);
							if (match.id == updatedContent.contentId || match.contentId == updatedContent.contentId) {
								board.matches[key] = updatedContent;
								board.lastUpdate = new Date().getTime();
								clearContent(updatedContent, "match", function (c) {
									nsp.to(board.contentId).emit("match", c);
								});
							}
						});
					}
				});
			}
		}

	}
}


function handleAndParseContentHubReturn(content, callback) {
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
	callback.apply(this, []);
}
var changesCallback = function (result) {
	var updatedContent = [];

	function addContentIdsToList(content) {
		if (content.type == "CREATED") {
			if (content.content[0] && content.content[0].id[0]) {
				var contentId = content.content[0].id[0];
				// prevent duplicates
				if (updatedContent.indexOf(contentId) == -1) {
					updatedContent.push(contentId);
				}
			}
		}
	}

	function fetchAndSaveContent(contentId) {
		contentHub.getContent(contentId, function (content) {
			handleAndParseContentHubReturn(content, propagateUpdates);
		})
	}

	if (result && result.changelist && result.changelist.event) {
		result.changelist.event.forEach(addContentIdsToList);
		updatedContent.forEach(fetchAndSaveContent)
	}
}

var init = function () {
	// TODO: encontrar uma forma de manter as chaves de autenticação entre os requests
	var that = this;
	try {
		contentHub.checkChanges(10 * 1000, changesCallback);
	} catch (error) {
		console.log("Ocorreu um erro ao verificar as alterações no servidor", error);
		that.apply(this, []);
	}
};
init();

// TODO: limpar array de partidas e placares

server.listen(3000);