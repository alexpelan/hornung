var request = require('request-promise');
var cheerio = require('cheerio');
var robots = require('robots');
var parser = new robots.RobotsParser(null, {});
var jeopardyParser = require('./lib/JeopardyParser');

var MongoClient = require('mongodb').MongoClient,
	assert = require('assert');

var url = 'mongodb://localhost:27017/hornung';
var USER_AGENT = "Alex Pelan (alexpelan@gmail.com)";
var ROBOTS_URL = "http://www.j-archive.com/robots.txt";

var createOrUpdateGame = function(db, delay, gameId) {	
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			var url = "http://www.j-archive.com/showgame.php?game_id=" + gameId;
			request(url).then(function(html) {
				var gameJson = jeopardyParser.parseJeopardyGame(html)
				var gamesCollection = db.collection("games");
				gamesCollection.updateOne({id: gameId}, {$set: gameJson}, {upsert: true}, function(err, result) {
					resolve();
				});
			}).catch(function(error){
				console.log("error requesting ", error);
			});
		}, delay * 1000);
	});
};

// similar to seedGames in seedFullDatabase for now
var createOrUpdateGames = function(db, delayPerRequest, gamesJson) {
	var counter = 0;
	var gamePromises = [];
	gamesJson.forEach(function(game) {
		var delay = delayPerRequest * counter;
		counter = counter + 1;
		gamePromises.push(createOrUpdateGame(db, delay, game.id));
	});

	return gamePromises;
};

const fetchLatestSeasonGames = function(db, delayPerRequest, seasonId) {
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			var url = "http://www.j-archive.com/showseason.php?season=" + seasonId;
			request(url).then(function(html) {
				var gamesJson = jeopardyParser.parseJeopardySeason(html).games;
				gamesJson.forEach(function(game) {
					game.season = seasonId;
				});
				resolve(gamesJson);
			}).catch(function(error){
				console.log("error requesting ", error);
			});
		}, delayPerRequest * 1000);
	});
};

const findLatestSeasonId = function(db) {
	var url = "http://j-archive.com/listseasons.php";

	return new Promise(function (resolve, reject) {
		request(url).then(function(html) {
			var seasonsJson = jeopardyParser.parseSeasonList(html).seasons;
			resolve(seasonsJson[0].id);
		}).catch(function(error){
			console.log("error requesting ", error);
		});
    });

};

// Fetch the most recent season and add whatever games we don't have already. 

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

			findLatestSeasonId(db).then(function(id) {
				fetchLatestSeasonGames(db, delayInSeconds, id).then(function(gamesJson) {
					Promise.all(createOrUpdateGames(db, delayInSeconds, gamesJson)).then(function() {
						db.close();
					});
				});

			}).catch(function(error) {
				console.log("error fetching latest season")
			});
		}
	});
});