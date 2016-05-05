var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	contentHub = require("./bin/contenthub"),
	util = require("./lib/util"),
	footstats = require("./lib/footstats");


var scoreBoardsAndMatches = [];

var nsp = io.of("/livescore");
//io.set('origins', config.origins);
nsp.on('connection', function (socket) {
	var liveScoreId = socket.handshake.query.id;
	if (!liveScoreId || liveScoreId == "undefined") return;
	console.log("connected", liveScoreId);
	socket.join(liveScoreId);
	getScoreboardContent(liveScoreId, function (content) {
		util.clearContent(content, "scoreboard", function (c) {
			socket.emit("scoreboard", c);
		});
	});
	/*	socket.on('disconnect', function () {
	 //console.log('user disconnected');
	 });*/
});


/**
 * Search for the scoreboard content to send it to the connecting client.
 * It will search the scoreboard array for a valid content based on the contentId got on scoreBoardId parameter.
 *
 * @param scoreBoardId scoreboard ContentId
 * @param callback function
 */
function getScoreboardContent(scoreBoardId, callback) {
	var found = false;
	scoreBoardsAndMatches.forEach(function (board, key) {
		if (board.contentId == scoreBoardId) {
			found = true;
			return callback.apply(this, [board]);
		}
	});
	contentHub.getContent(scoreBoardId, true, function (cHubContent) {
		footstats.handleAndParseContentHubReturn(cHubContent, function (parsedContent) {
			var contentToEmit = updateScoreboards(parsedContent);
			return callback.apply(this, [contentToEmit]);
		});
	});
}

function updateScoreboards(content) {
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
	return {};
}

/**
 * Prepare content to be send to connected clients.
 * If the updated content is a match it will search in all scoreboards for references to this match and update the board
 * @param updatedContent
 */
function propagateUpdates(updatedContent) {
	if (updatedContent == "undefined") return;
	//console.log("PO",updatedContent);
	// the full board has been updated
	if (updatedContent._type == "br.com.hed.third.party.service.footstats.match.scoreBoard.match.ScoreBoardModelMapping$ScoreBoardModel") {
		var contentToPropagate = updateScoreboards(updatedContent);
		util.clearContent(contentToPropagate, "scoreboard", function (c) {
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
								util.clearContent(updatedContent, "match", function (c) {
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


var changesCallback = function (result) {
	var updatedContent = [];

	/**
	 * Add changed contentIds to updatedContent that will be used to fetch the updated content from the content-hub WS
	 * @param content   {"type":"CREATED|REMOVED","content":{"id":"7.2050","version":"1462280735"}}
	 */
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
			footstats.handleAndParseContentHubReturn(content, propagateUpdates);
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