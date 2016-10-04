var express = require('express');
var request = require('request');
var router = express.Router();

var MongoClient = require('mongodb').MongoClient,
	assert = require('assert');

var url = 'mongodb://localhost:27017/test';

// router.get('/games/:id', function(req, res) {

// 	var id;
// 	if (!req.params.id) {
// 		id = "5002";
// 	} else {
// 		id = req.params.id;
// 	}

// 	var url = "http://www.j-archive.com/showgame.php?game_id=" + id;

// 	request(url, function(error, response, html){
// 		if(!error){
// 			res.json(parseJeopardyGame(html));
// 		}
// 		else{
// 			console.log(error);
// 		}

// 	});
// });

// router.get("/seasons/:id", function(req, res) {
// 	var url = "http://www.j-archive.com/showseason.php?season=" + req.params.id;

// 	request(url, function(error, response, html) {
// 		if (!error) {
// 			res.json(parseJeopardySeason(html));
// 		} else {
// 			console.log(error);
// 		}
// 	});
// });

router.get("/", function(req, res) {
	MongoClient.connect(url, function(err, db) {
		var seasonsCollection = db.collection("seasons");
		seasonsCollection.find({}).toArray().then(function(result){
			console.log(result)
			res.json({
				"status": "ok",
				seasons: result
			});
			db.close();
		});

	});

});


module.exports = router;