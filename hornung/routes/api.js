var express = require('express');
var request = require('request');
var router = express.Router();

var MongoClient = require('mongodb').MongoClient,
	assert = require('assert');

var url = 'mongodb://localhost:27017/test';

router.get('/games/:id', function(req, res) {
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
			})
			db.close();
		});
	});
});

router.get("/", function(req, res) {
	MongoClient.connect(url, function(err, db) {
		var seasonsCollection = db.collection("seasons");
		seasonsCollection.find({}).sort({sortNumber: -1}).toArray().then(function(result){
			res.json({
				"status": "ok",
				seasons: result
			});
			db.close();
		});

	});

});

router.post("/dispute", function(req, res) {

	MongoClient.connect(url, function(err, db) {
		var disputeData = JSON.parse(Object.keys(req.body)[0]); //no idea why it formats it as {JSONBODY: ""} when posting JSON via fetch
		var disputeCollection = db.collection("disputes")
		disputeCollection.insert(disputeData).then(function(err, result) {
			res.json({
				"status": "ok"
			});
			db.close();
		});
	});

});


module.exports = router;