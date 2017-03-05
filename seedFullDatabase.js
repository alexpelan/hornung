var request = require('request-promise');
var cheerio = require('cheerio');
var robots = require('robots');
var parser = new robots.RobotsParser(null, {});
var jeopardyParser = require('./lib/JeopardyParser');

var MongoClient = require('mongodb').MongoClient,
	assert = require('assert');

var url = 'mongodb://localhost:27017/hornung'
var USER_AGENT = "Alex Pelan (alexpelan@gmail.com)";
var ROBOTS_URL = "http://www.j-archive.com/robots.txt";

var seedGame = function(gameId, delay, db) {	
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			var url = "http://www.j-archive.com/showgame.php?game_id=" + gameId;
			request(url).then(function(html) {
				var gameJson = jeopardyParser.parseJeopardyGame(html)
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

var seedSeason = function(seasonId, delay, db) {
	return new Promise(function(resolve, reject) {
		setTimeout(function() {
			var url = "http://www.j-archive.com/showseason.php?season=" + seasonId;
			request(url).then(function(html) {
				var gamesJson = jeopardyParser.parseJeopardySeason(html).games;
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

var seedListOfSeasons = function(db) {
	var url = "http://j-archive.com/listseasons.php";

	return new Promise(function (resolve, reject) {
		request(url).then(function(html) {
			var seasonsJson = jeopardyParser.parseSeasonList(html).seasons;
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