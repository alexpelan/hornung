const express = require("express");
const router = express.Router();

const MongoClient = require("mongodb").MongoClient;

const url = process.env.DB_URL;


router.get("/games/:id", function(req, res) {
	MongoClient.connect(url, function(err, db) {
		var gamesCollection = db.collection("games");
		gamesCollection.find({id: req.params.id}).toArray().then(function(results) {
			res.json(results[0]);
			db.close();
		});
	});
});

router.get("/seasons/:id", function(req, res) {
	MongoClient.connect(url, function(err, db) {
		var gamesCollection = db.collection("games");
		gamesCollection.find({season: req.params.id}, {id: 1, displayName: 1}).toArray().then(function(results) {
			var transformedResults = {}; // transform the data for easier construction of the state on the client 
			results.forEach(function(result) {
				transformedResults[result.id] = {
					displayName: result.displayName
				};
			});
			res.json({
				status: "ok",
				games: transformedResults
			});
			db.close();
		});
	});
});

router.get("/", function(req, res) {
	MongoClient.connect(url, function(err, db) {
		var seasonsCollection = db.collection("seasons");
		seasonsCollection.find({}).sort({sortNumber: -1}).toArray().then(function(results){
			// On the front end, the fetch API's response.json() seems to transform
			// anything named 'id' into a number (but still a string, like '0'?)
			// very odd - anyway it doesn't mess with seasonId so we use that
			results.forEach((result) => {
				result.seasonId = result.id;
			});

			res.json({
				"status": "ok",
				seasons: results
			});
			db.close();
		});

	});

});

router.post("/dispute", function(req, res) {

	MongoClient.connect(url, function(err, db) {
		var disputeCollection = db.collection("disputes");
		const disputeJson = {
			clue: req.body.clue,
			userAnswer: req.body.userAnswer
		};
		disputeCollection.insert(disputeJson).then(function() {
			res.json({
				"status": "ok"
			});
			db.close();
		});
	});

});


module.exports = router;