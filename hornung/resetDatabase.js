var MongoClient = require('mongodb').MongoClient,
	assert = require('assert');

var url = 'mongodb://localhost:27017/test';

//Mostly should be used for testing!
MongoClient.connect(url, function(err, db) {
	assert.equal(null, err);

	db.collection("seasons").remove({}, function(err, result) {
		db.close();
	});

});