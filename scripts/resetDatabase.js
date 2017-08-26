require("dotenv").config({ path: "./env." + process.env.NODE_ENV });
var MongoClient = require("mongodb").MongoClient,
	assert = require("assert");

var url = process.env.DB_URL;

const doRightAndKillEverything = function(db, shouldClose=true) {
	return new Promise(function(resolve) {
		db.collection("seasons").remove({}, function() {
			db.collection("games").remove({}, function() {
				if (shouldClose) {
					db.close();
				}
				resolve();
			});
		});
	});
};

//Mostly should be used for testing! You probably don't want to do this
MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);

	doRightAndKillEverything(db);

});

module.exports = doRightAndKillEverything;