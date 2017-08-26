require("dotenv").config({ path: "./env." + process.env.NODE_ENV });

const MongoClient = require("mongodb").MongoClient;
const scraper = require("../scripts/seedFullDatabase");

const resetDatabase = require("../scripts/resetDatabase");


const url = process.env.DB_URL;

// FIXFIX: cleaning up database should be done before and after every spec rather than manually managed

describe("J-Archive scraping scripts", function() {
	
	it("seedGame should create an entry for the game on the html page in the games collection", (done) => {
		const gameId = "7574";

		MongoClient.connect(url, function(err, db) {

			resetDatabase(db, false).then(() => {
				const gamesCollection = db.collection("games");
				gamesCollection.insertOne({id: gameId}).then(() => {
					scraper.seedGame(gameId, 0, db).then(() => {
						gamesCollection.find({id: gameId}).toArray().then(function(results) {
							expect(results.length).toEqual(1);
							db.close();
							done();
						});

					});

				});

			});

		});

	});


	it("seedListOfSeasons creates empty entries (basically just id and display name) for every season on the html page", (done) => {

		MongoClient.connect(url, function(err, db) {

			resetDatabase(db, false).then(() => {
				scraper.seedListOfSeasons(db).then(() => {
					const seasonsCollection = db.collection("seasons");
					seasonsCollection.find({}).toArray().then(function(results) {
						expect(results.length).toEqual(35);
						resetDatabase(db, true).then(() =>  {
							done();
						});
					});

				});

			});

		});

	});

	it("seedSeason creates empty game entries (basically just id and display name for every game on the season html page", (done) => {

		MongoClient.connect(url, function(err, db) {
			const seasonId = "33";

			resetDatabase(db, false).then(() => {
				scraper.seedSeason(seasonId, 0, db).then(() => {
					const gamesCollection = db.collection("games");
					gamesCollection.find({season: seasonId}).toArray().then(function(results) {
						expect(results.length).toEqual(222);
						resetDatabase(db, true).then(() =>  {
							done();
						});
					});

				});

			});

		});

	});

});