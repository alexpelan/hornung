require("dotenv").config({ path: "./env." + process.env.NODE_ENV });
var request = require("request-promise");
require("cheerio");
var robots = require("robots");
var parser = new robots.RobotsParser(null, {});
var jeopardyParser = require("../lib/JeopardyParser");

var MongoClient = require("mongodb").MongoClient,
	assert = require("assert");

var url = process.env.DB_URL;
var USER_AGENT = "Alex Pelan (alexpelan@gmail.com)";
var ROBOTS_URL = "http://www.j-archive.com/robots.txt";

let requestOptions = {
	url: "",
	headers: {
		"User-Agent": USER_AGENT
	}
};

var seedGame = function(gameId, delay, db) {	
	return new Promise(function(resolve) {
		setTimeout(function() {
			var url = process.env.GAME_URL + gameId;
			requestOptions.url = url;
			request(requestOptions).then(function(html) {
				var gameJson = jeopardyParser.parseJeopardyGame(html);
				var gamesCollection = db.collection("games");
				gamesCollection.updateOne({id: gameId}, {$set: gameJson}, function() {
					resolve();
				});
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
	return new Promise(function(resolve) {
		setTimeout(function() {
			var url = process.env.SEASON_URL + seasonId;
			requestOptions.url = url;
			request(requestOptions).then(function(html) {
				var gamesJson = jeopardyParser.parseJeopardySeason(html).games;
				gamesJson.forEach(function(game) {
					game.season = seasonId;
				});
				var gamesCollection = db.collection("games");
				gamesCollection.insertMany(gamesJson, function() {
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
	var url = process.env.LIST_SEASONS_URL;
	requestOptions.url = url;

	return new Promise(function (resolve) {
		request(requestOptions).then(function(html) {
			var seasonsJson = jeopardyParser.parseSeasonList(html).seasons;
			var seasonsCollection = db.collection("seasons");
			seasonsCollection.insertMany(seasonsJson, function() {
				resolve(seasonsJson);
			});
		}).catch(function(error){
			console.log("error requesting ", error);
		});
	});

};

const seedFullDatabase = function(db, delayInSeconds) {
	seedListOfSeasons(db).then(function(seasonsJson) {
		var promises = seedSeasons(seasonsJson, delayInSeconds, db);
		Promise.all(promises).then(function(gamesJson){
			Promise.all(seedGames(gamesJson, delayInSeconds, db)).then(function() {
				db.close();
			}).catch(function(error) {
				console.log("error fetching list of games", error);
			});
		}).catch(function(error){
			console.log("error fetching listOfSeasons ", error);
		});
	});
};


const seedSingleSeason = function(db, delayInSeconds, seasonNumber) {
	var gamesCollection = db.collection("games");
	gamesCollection.find({season: seasonNumber}).toArray().then(function(results) {
		let counter = 0;
		var promises = results.map((game) => {
			counter = counter + 1;
			return seedGame(game.id, delayInSeconds * counter, db);
		});
		Promise.all(promises).then(function() {
			console.log("done seeding single season with no errors");
			db.close();
		}).catch(function(error) {
			console.log("error resolving seedGame promises ", error);
		});
	});
};

// Finds every game without a jeopardy attribute and fills out the game
const finishIncomplete = function(db, delayInSeconds) {
	const gamesCollection = db.collection("games");
	gamesCollection.find({jeopardy: {$exists: false}}).toArray().then(function(results) {
		let counter = 0;
		let promises = results.map((game) => {
			counter = counter + 1;
			return seedGame(game.id, delayInSeconds * counter, db);
		});
		Promise.all(promises).then(function() {
			console.log("done seeding all reamining games with no errors");
			db.close();
		}).catch(function(error) {
			console.log("error resolving seedGame promises in finishIncomplete ", error);
		});
	});
};

const main = function(season) {
	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		const shouldSeedSingleSeason = season;
		const shouldFinishIncomplete = false;//argv.incomplete;
		const shouldSeedFullDatabase = false;//!shouldFinishIncomplete && !shouldFinishIncomplete;
		parser.setUrl(ROBOTS_URL, function(parser, success) {
			if(success) {
				var delayInSeconds = parser.getCrawlDelay(USER_AGENT);
				if (shouldSeedFullDatabase) {
					seedFullDatabase(db, delayInSeconds);
				} else if (shouldSeedSingleSeason) {
					const seasonNumber = season;
					seedSingleSeason(db, delayInSeconds, seasonNumber);
				} else if (shouldFinishIncomplete) {
					finishIncomplete(db, delayInSeconds);
				}

			}
		});
	});

};

module.exports = {
	seedGame,
	seedListOfSeasons,
	seedSeason,
	main,
};