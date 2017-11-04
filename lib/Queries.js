const Queries = {

	findMostRecentSeason: function(db) {
		return new Promise(function(resolve) {
			const seasonsCollection = db.collection("seasons");
			let highestSeason = 0;
			seasonsCollection.find({}).toArray().then((results) => {
				results.forEach((result) => {
					const seasonNumber = parseInt(result.id);
					if (seasonNumber > highestSeason) {
						highestSeason = seasonNumber;
					}
				});
				resolve(highestSeason);
			});
		});
	}

};

module.exports = Queries;