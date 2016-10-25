var request = require('request-promise');
var cheerio = require('cheerio');
var robots = require('robots');
var parser = new robots.RobotsParser(null, {});

var MongoClient = require('mongodb').MongoClient,
	assert = require('assert');

var url = 'mongodb://localhost:27017/test';
var USER_AGENT = "Alex Pelan (alexpelan@gmail.com)";
var ROBOTS_URL = "http://www.j-archive.com/robots.txt";

var parseAnswerFromMouseoverHandler = function($, $clue, startString) {
	if (!$clue.find) {
		return;
	}
	var mouseoverHandler = $clue.find("div").first().attr("onmouseover");

	if (!mouseoverHandler) {
		return;
	}
	var startOfAnswer = mouseoverHandler.indexOf(startString);
	var endOfAnswer = mouseoverHandler.indexOf("</em>");
	var answer = mouseoverHandler.slice(startOfAnswer + startString.length, endOfAnswer);
	answer = $("<p>" + answer + "</p>").text(); //some answers have html for display in them, we don't want that
	return answer
};

var parseMedia = function($, $clue) {
	var media = [];

	$clue.find(".clue_text a").each(function(index, element) {
		var mediaObject = {};
		mediaObject.url = $(element).attr("href");

		var extension = mediaObject.url.slice(mediaObject.url.lastIndexOf(".") + 1);
		var MEDIA_TYPES = {
			"png": "image",
			"jpg": "image",
			"mp3": "audio"
		}
		var type = MEDIA_TYPES[extension];

		if (!type) 	{
			return;
		}

		mediaObject.type = type;

		media.push(mediaObject);
	});

	return media;
};

var parseJeopardySubgame = function($, jeopardyDiv, dollarAmountDelta){
	var game = {};
	var categoryOrder = {};
	game.categories = [];
	//parse categories
	jeopardyDiv.find(".category_name").each(function(index, element){
		var categoryTitle = $(element).text().trim();
		var newCategory = {
			name: categoryTitle,
			clues: []
		};
		game.categories.push(newCategory);
		categoryOrder[index] = categoryTitle;
	});

	jeopardyDiv.find(".clue").each(function(index, element){
		var value = $(element).find(".clue_value").text().trim();
		var isDailyDouble = false;


		var columnIndex = index % 6;
		// if no value, it's a daily double. We can use gameName and the previous clue's value to figure it out (daily double will never be first in a category)
		if (!value) {
			var numberOfClues = game.categories[columnIndex].clues.length;
			var previousClue = game.categories[columnIndex].clues[numberOfClues - 1];
			var previousValue = 0;
			if (!previousClue) { // lowest row in the column
				if (columnIndex === 0 ) {
					return; //FIXFIX:  daily double in first row, first column
				}

				previousClue = game.categories[columnIndex - 1].clues[numberOfClues];

				if (!previousClue) {
					return;
				}

				value = previousClue.value.slice(1);
			} else {
				previousValue = previousClue.value;
				previousValue = previousValue.slice(1);
				value = parseInt(previousValue) + dollarAmountDelta;

			}

			isDailyDouble = true;
			value = "$" + value;
		}

		var question = $(element).find(".clue_text").text().trim();

		if (!question) { // some games are just missing data
			return;
		}

		//j-archive shows the answer via an onmouseover handler, we need to parse it out to figure out the actual answer
		var answer = parseAnswerFromMouseoverHandler($, $(element), '"correct_response">');

		if (!answer) {
			return;
		}

		var media = parseMedia($, $(element));

		var fullQuestionObject = {
			value: value,
			question: question,
			answer: answer,
			media: media,
			isDailyDouble: isDailyDouble
		};

		game.categories[columnIndex].clues.push(fullQuestionObject);

	});


	return game;
};

var parseFinalJeopardy = function($){
	var result = {};
	var categoryName = $(".final_round .category").text().trim();
	var question = $(".final_round .clue_text").text().trim();
	var answer = parseAnswerFromMouseoverHandler($, $(".final_round .category"), '\\"correct_response\\">');
	return {
		categories: [{
			name: categoryName,
			question: question,
			answer: answer
		}]
	};
}

var parseJeopardyGame = function(html){
	var $ = cheerio.load(html);
	var gameTitle = $("#game_title").text().trim();
	var titleTokens = gameTitle.split("-");

	var isNewValueGame = $("#double_jeopardy_round:contains($2000)").length > 0;
	var dollarAmountDelta;

	if (isNewValueGame) {
		dollarAmountDelta = 200;
	} else {
		dollarAmountDelta = 100;
	}

	var jeopardy = parseJeopardySubgame($, $("#jeopardy_round"), dollarAmountDelta);
	var doubleJeopardy = parseJeopardySubgame($, $("#double_jeopardy_round"), 2 * dollarAmountDelta);
	var finalJeopardy = parseFinalJeopardy($);

	return {
		"show_number": titleTokens[0].trim(),
		"air_date": titleTokens[1].trim(),
		"jeopardy": jeopardy,
		"double_jeopardy": doubleJeopardy,
		"final_jeopardy": finalJeopardy
	};
}

var seedGame = function(gameId, delay, db) {	
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			var url = "http://www.j-archive.com/showgame.php?game_id=" + gameId;
			request(url).then(function(html) {
				var gameJson = parseJeopardyGame(html)
				var gamesCollection = db.collection("games");
				gamesCollection.updateOne({id: gameId}, {$set: gameJson}, function(err, result) {
					resolve();
				});
			}).catch(function(error){
				console.log("error requesting ", error);
			});
		}, delay * 1000);
	});
};

var seedGames = function(gamesJson, delayPerRequest, db) {
	var counter = 0;
	var gamePromises = [];
	gamesJson.forEach(function(gamesFromSingleSeason) {

		gamesFromSingleSeason.forEach(function(game) {
			var delay = delayPerRequest * counter;
			counter = counter + 1;
			gamePromises.push(seedGame(game.id, delay, db));
		});

	});

	return gamePromises;
};


//
// List of Games per season
//

var parseJeopardySeason = function(html) {
	var $ = cheerio.load(html);
	
	var seasonsTable = $("#content table");
	var games = [];

	seasonsTable.find("tr").each(function(index, element) {
		var gameIdParam = "?game_id=";
		var url = $(element).find("td a").first().attr("href");
		var gameIdIndex = url.lastIndexOf(gameIdParam);
		var id = url.slice(gameIdIndex + gameIdParam.length);
		var displayName = $(element).find("td").first().text().trim();
		var newGame = {id: id, displayName: displayName};
		games.push(newGame);
	});

	return {
		games: games
	};
};

var seedSeason = function(seasonId, delay, db) {
	if (delay >= 20) { // short-circuit and just fetch the most recent season for testing
		return new Promise(function(resolve, reject){
			resolve([]);
		}); 
	}
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			var url = "http://www.j-archive.com/showseason.php?season=" + seasonId;
			request(url).then(function(html) {
				var gamesJson = parseJeopardySeason(html).games;
				gamesJson.forEach(function(game) {
					game.season = seasonId;
				});
				var gamesCollection = db.collection("games");
				gamesCollection.insertMany(gamesJson, function(err, result) {
					resolve(gamesJson);
				});
			}).catch(function(error){
				console.log("error requesting ", error);
			});
		}, delay * 1000);
	});
};

var seedSeasons = function(seasonsJson, delayPerRequest, db) {
	var seasonPromises = [];
	seasonsJson.forEach(function(season, index){
		var delay = delayPerRequest * index;
		seasonPromises.push(seedSeason(season.id, delay, db));
	});

	return seasonPromises;
};

//
// List of Seasons (top-level menu)
//

var parseSeasonList = function(html) {
	var $ = cheerio.load(html)

	var seasonsTable = $("#content table");
	var seasons = [];
	var counter = 0;

	seasonsTable.find("tr").each(function(index, element) {
		var seasonIdParam = "?season=";
		var url = $(element).find("td a").first().attr("href");
		var gameIdIndex = url.lastIndexOf(seasonIdParam);
		var id = url.slice(gameIdIndex + seasonIdParam.length);
		var displayName = $(element).find("td").first().text().trim();
		var newSeason = { id: id, displayName: displayName , sortNumber: counter};
		counter = counter + 1;
		seasons.push(newSeason);
	});

	return {
		seasons: seasons
	};

};

var seedListOfSeasons = function(db) {
	var url = "http://j-archive.com/listseasons.php";

	return new Promise(function (resolve, reject) {
		request(url).then(function(html) {
			var seasonsJson = parseSeasonList(html).seasons;
			var seasonsCollection = db.collection("seasons");
			seasonsCollection.insertMany(seasonsJson, function(err, result) {
				resolve(seasonsJson);
			});
		}).catch(function(error){
			console.log("error requesting ", error);
		});
    });

};

MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);
	var requestOptions = {
		url: "",
		headers: {
			"User-Agent": USER_AGENT//be kind
		}
	};

	parser.setUrl(ROBOTS_URL, function(parser, success) {
		if(success) {
			var delayInSeconds = parser.getCrawlDelay(USER_AGENT);

			seedListOfSeasons(db).then(function(seasonsJson) {
				var promises = seedSeasons(seasonsJson, delayInSeconds, db)
				Promise.all(promises).then(function(gamesJson){
					Promise.all(seedGames(gamesJson, delayInSeconds, db)).then(function() {
						db.close();
					}).catch(function(error) {
						console.log("error fetching list of games", error)
					});
				}).catch(function(error){
					console.log("error fetching listOfSeasons ", error)
				});
			});
		}
	});
});