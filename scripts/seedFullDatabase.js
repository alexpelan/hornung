require("dotenv").config({ path: "./env." + process.env.NODE_ENV });
var request = require("request-promise");
require("cheerio");
var robots = require("robots");
var parser = new robots.RobotsParser(null, {});
var jeopardyParser = require("../lib/JeopardyParser");
const Queries = require("../lib/Queries");

var MongoClient = require("mongodb").MongoClient,
	assert = require("assert");

var url = process.env.DB_URL;
var USER_AGENT = "Alex Pelan (alexpelan@gmail.com)";
var ROBOTS_URL = "http://www.j-archive.com/robots.txt";
const EARLIEST_SEASON = 30;

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
				console.log("updating game ", gameId, " with ", gameJson);
				gamesCollection.updateOne({id: gameId}, {$set: gameJson}, function() {
					resolve();
				});
			});
		}, delay * 1000);
	});
};

// gamesJson is an array of arrays of games
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

var seedSeason = function(seasonId, delay, db, checkForExisting=false) {
	return new Promise(function(resolve) {
		setTimeout(function() {
			var url = process.env.SEASON_URL + seasonId;
			requestOptions.url = url;
			request(requestOptions).then(function(html) {
				var gamesJson = jeopardyParser.parseJeopardySeason(html).games;
				gamesJson.forEach(function(game) {
					game.season = seasonId;
				});

				if (checkForExisting) {
					insertNewGamesMetadata(db, gamesJson).then((gamesToFinish) => resolve(gamesToFinish));
				} else {
					var gamesCollection = db.collection("games");
					gamesCollection.insertMany(gamesJson, function() {
						resolve(gamesJson);
					});				
				}
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
			const seasonsJson = jeopardyParser.parseSeasonList(html).seasons;
			const filteredSeasonsJson = seasonsJson.filter((season) => {
				return parseInt(season.id) >= EARLIEST_SEASON;
			});
			var seasonsCollection = db.collection("seasons");
			// always do a complete removal
			seasonsCollection.removeMany({}).then(() => {
				seasonsCollection.insertMany(filteredSeasonsJson, function() {
					resolve(filteredSeasonsJson);
				});
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

const insertNewGamesMetadata = function(db, gamesJson) {
	return new Promise(function(resolve) {
		///fetch all the games
		const gamesCollection = db.collection("games");
		gamesCollection.find({}).toArray().then((gamesInDb) => {
			// figure out which games aren't in the database.
			let gamesToInsert = gamesJson.filter((game) => {
				return !gamesInDb.some((gameInDb) => {
					return gameInDb.id === game.id;
				});
			});

			// insert the ones that aren't
			if (gamesToInsert.length > 0) {
				gamesCollection.insertMany(gamesToInsert, function() {
					resolve(gamesToInsert);
				});
			} else {
				resolve();
			}

		});

	});

};

const checkForNewSeason = function(db, delayInSeconds) {
	let foundAnySeason = false;
	var url = process.env.LIST_SEASONS_URL;
	requestOptions.url = url;

	return new Promise(function (resolve) {
		setTimeout(() => {
			request(requestOptions).then(function(html) {
				const seasonsJson = jeopardyParser.parseSeasonList(html).seasons;
				const filteredSeasonsJson = seasonsJson.filter((season) => {
					return parseInt(season.id) >= EARLIEST_SEASON;
				});
				var seasonsCollection = db.collection("seasons");
				seasonsCollection.find({}).toArray().then((seasonsInDb) => {
					filteredSeasonsJson.forEach((seasonFromPage) => {
						const foundNewSeason = !seasonsInDb.some((seasonInDb) => seasonInDb.id === seasonFromPage.id);
						if (foundNewSeason) {
							foundAnySeason = true;
							seedListOfSeasons(db).then(() => {
								seedSeason(seasonFromPage.id.toString(), delayInSeconds, db, false).then((gamesJson)  => {
									if (gamesJson) {
										Promise.all(seedGames([gamesJson], delayInSeconds, db)).then(() => {
											db.close();
											resolve();
										});
									}  else {
										resolve();
									}
								});
							});

						} 
					});

					if (!foundAnySeason) {
						resolve();
					}
				});
			}).catch(function(error){
				console.log("error requesting ", error);
			});
		}, delayInSeconds * 1000);
	});
};

const checkForUpdates = function(db, delayInSeconds) {
	Queries.findMostRecentSeason(db).then((result) => {

		const checkForExisting = true;
		seedSeason(result.toString(), delayInSeconds, db, checkForExisting).then((gamesToFinish)  => {
			// if there are new games in the most recent season, then add those. otherwise, check for a new season
			if (gamesToFinish) {
				Promise.all(seedGames([gamesToFinish], delayInSeconds, db)).then(() => db.close());
			} else {
				// then, check for a new season, and if we find one, seed ALL games from that new season
				checkForNewSeason(db, delayInSeconds).then(() =>  {
					db.close();
				});
			}
		});
	});
};

const executeTask = function(taskFunction) {
	MongoClient.connect(url, function(err, db) {
		assert.equal(null, err);

		parser.setUrl(ROBOTS_URL, function(parser, success) {
			if(success) {
				var delayInSeconds = parser.getCrawlDelay(USER_AGENT);
				taskFunction(db, delayInSeconds);
			}
		});
	});
};


const firstTimeSetupEnvironment = function() {
	executeTask(seedFullDatabase);
};

const updateEnvironment = function() {
	executeTask(checkForUpdates);
};


module.exports = {
	seedGame,
	seedListOfSeasons,
	seedSeason,
	firstTimeSetupEnvironment,
	updateEnvironment,
};