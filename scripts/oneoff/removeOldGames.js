var MongoClient = require('mongodb').MongoClient,
	assert = require('assert');

var url = 'mongodb://localhost:27017/hornung'

// remove anything not from the most recent season
const MOST_RECENT_SEASONS = ["33", "32", "31", "30", "29"];

MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);

	let gamesCollection = db.collection("games");
	gamesCollection.remove({season: {$nin: MOST_RECENT_SEASONS}}, (err, doc) => {
		console.log("err is ", err, " doc is ", doc);
		db.close();
	});

});