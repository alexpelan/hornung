require("dotenv").config({ path: "./env." + process.env.NODE_ENV });
const MongoClient = require("mongodb").MongoClient;
const Factory = require("./Factory");

const url = process.env.DB_URL;

const TestHelper = {

	createGame: function() {
		return new Promise(function(resolve) {
			MongoClient.connect(url, function(err, db) {
				const game = Factory.game();
				const gamesCollection = db.collection("games");
				gamesCollection.insertOne(game, function() {
					db.close();
					resolve(game);
				});
			});
		});
	},

	createSeasons: function() {
		return new Promise(function(resolve) {
			MongoClient.connect(url, function(err, db) {
				const seasonList = Factory.seasonList();
				const seasonsCollection = db.collection("seasons");
				seasonsCollection.insertMany(seasonList.seasons, function() {
					db.close();
					resolve(seasonList);
				});
			});
		});
	}
};

module.exports = TestHelper;