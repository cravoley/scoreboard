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
	getScoreboardContent(liveScoreId, function (err, content) {
		// console.log("CLEAR",content);
		util.clearContent(footstats.prepareContentForTransmission(content), "scoreboard", function (c) {
			// console.log("SEND",c);
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
	scoreBoardsAndMatches.forEach(function (board) {
		if (board.contentId == scoreBoardId) {
			found = true;
			return callback.apply(this, [null, board]);
		}
	});
	if (!found)
		contentHub.getContent(scoreBoardId, true, function (err, cHubContent) {
			footstats.handleAndParseContentHubReturn(cHubContent, function (err, contentToEmit) {
				return callback.apply(this, [null, contentToEmit]);
			});
		});
}

/**
 * Update scoreboard array and return the updated scoreboard
 * @param content
 * @returns {*}
 */
function updateScoreboards(content) {
	if (content && content.contentId) {
		var found = false;
		scoreBoardsAndMatches.forEach(function (board, key) {
			if (board.contentId == content.contentId) {
				found = key;
				return;
			}
		});
		if (found === false) {
			scoreBoardsAndMatches.push(content);
		} else {
			scoreBoardsAndMatches[found] = content;
		}
		return content;
	}
	return {};
}

/**
 * Prepare content to be send to connected clients.
 * If the updated content is a match it will search in all scoreboards for references to this match and update the board
 * @param updatedContent
 */
function propagateUpdates(err,updatedContent) {
	if (updatedContent == "undefined") return;
	//console.log("PO",updatedContent);
	// the full board has been updated
	if (updatedContent._type == "br.com.hed.third.party.service.footstats.match.scoreBoard.match.ScoreBoardModelMapping$ScoreBoardModel") {
		var contentToPropagate = updateScoreboards(footstats.prepareContentForTransmission(updatedContent));
		util.clearContent(contentToPropagate, "scoreboard", function (c) {
			// console.log("Sending update to ",updatedContent.contentId, c);
			nsp.to(updatedContent.contentId).emit("scoreboard", c);
		});
	} else if (updatedContent._type == "br.com.hed.third.party.service.footstats.match.scoreBoard.match.ScoreBoardMatchModelMapping$MatchBean") {
		//console.log("T", updatedContent, scoreBoardsAndMatches )
		if (updatedContent.contentId) {
			// Search scoreBoards where this match is referenced
			if (scoreBoardsAndMatches) {
				scoreBoardsAndMatches.forEach(function (board) {
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


/**
 * Callback function that is called when a change is detected on content hub
 * @param result
 */
var changesCallback = function (err, result) {
	var updatedContent = [];

	/**
	 * Add changed contentIds to updatedContent that will be used to fetch the updated content from the content-hub WS
	 * @param content  the returned content from contenthub {"type":"CREATED|REMOVED","content":{"id":"7.2050","version":"1462280735"}}
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
		contentHub.getContent(contentId, function (err, content) {
			footstats.handleAndParseContentHubReturn(content, propagateUpdates);
		})
	}

	if (result && result.changelist && result.changelist.event) {
		result.changelist.event.forEach(addContentIdsToList);
		updatedContent.forEach(fetchAndSaveContent)
	}
};

// verifica as alterações a cada 1 segundo
contentHub.checkChanges(1000, changesCallback);

/**
 * clean scoreBoardsAndMatches array to save memory
 */
(function () {
	function cleanUp() {
		var tooOldTime = new Date();
		// there is no update for 45 minutes... the board is quite old, isn't it?
		tooOldTime.setMinutes(tooOldTime.getMinutes() - 45);
		scoreBoardsAndMatches = scoreBoardsAndMatches.filter(function (board) {
			if(board.lastUpdate < tooOldTime.getTime()){
				console.log("Board is too old, removing it",board);
				return false;
			}
			return true;
		});
		//console.log(scoreBoardsAndMatches);
		// execute it every minute
		setTimeout(cleanUp, 60 * 1000);
	}

	cleanUp();
})();


server.listen(3000);
