require("dotenv").config({ path: "./env." + process.env.NODE_ENV });
var MongoClient = require("mongodb").MongoClient,
	assert = require("assert");

var url = process.env.DB_URL;

//Mostly should be used for testing! You probably don't want to do this
MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);

	db.collection("seasons").remove({}, function() {
		db.collection("games").remove({}, function() {
			db.close();
		});
	});

});