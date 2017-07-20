const fs = require("fs");

const JeopardyParser = require("../lib/JeopardyParser");

const countDailyDoubles = function(game) {
	let dailyDoubleCount = 0;
	game.categories.forEach((category) => {
		category.clues.forEach((clue) => {
			if (clue.isDailyDouble) {
				dailyDoubleCount = dailyDoubleCount + 1;
			}
		});
	});
	return dailyDoubleCount;
};

describe("JeopardyParser", function() {
		
	describe("parseJeopardyGame", () => {

		it("parses the game", (done) =>{
			fs.readFile("./spec/data/show_7574.html", (err, data) => {
				if (err) {
					throw err;
				}

				// basic metadata
				const result = JeopardyParser.parseJeopardyGame(data.toString());
				expect(result.show_number).toEqual("Show #7574");
				expect(result.air_date).toEqual("Thursday, July 13, 2017");

				// category names
				const categoryNames = result.jeopardy.categories.map((cat) => cat.name);
				expect(categoryNames).toContain("WE\'RE TALKING BASEBALL");
				expect(categoryNames).toContain("AVIAN POETRY");
				expect(categoryNames).toContain("3 DIMENSIONAL");
				expect(categoryNames).toContain("WEBBY AWARD WINNERS");
				expect(categoryNames).toContain("ARGUMENT");
				expect(categoryNames).toContain("\"-ED\" HOMONYM");

				// clues are parsed correctly
				const oneClue = result.jeopardy.categories[0].clues[0];
				expect(oneClue.value).toEqual("$200");
				expect(oneClue.question).toEqual("Even better than a no-hitter, it's the rare feat of pitching the whole game & not allowing a single baserunner");
				expect(oneClue.answer).toEqual("a perfect game");

				// daily doubles - 1 for single jeopardy, 2 for double
				expect(countDailyDoubles(result.jeopardy)).toEqual(1);
				expect(countDailyDoubles(result.double_jeopardy)).toEqual(2);

				// and the right ones are marked as daily doubles
				expect(result.jeopardy.categories[4].clues[2].isDailyDouble).toBeTruthy();
				expect(result.jeopardy.categories[3].clues[1].isDailyDouble).toBeFalsy();

				expect(result.double_jeopardy.categories[2].clues[4].isDailyDouble).toBeTruthy();
				expect(result.double_jeopardy.categories[4].clues[1].isDailyDouble).toBeTruthy();

				//correctly uses a heuristic to determine the maximum amount for a round (this will be useful when we add old games which have jeopardy to 500, double to 1000)
				expect(result.jeopardy.highestDollarAmount).toEqual(1000);
				expect(result.double_jeopardy.highestDollarAmount).toEqual(2000);

				// final jeopardy has one category with a single question and answer
				expect(result.final_jeopardy.categories[0].name).toEqual("THE ACADEMY AWARDS");
				expect(result.final_jeopardy.categories[0].question).toEqual("He holds the record for time between acting nominations for the same role, 39 years between 1976 & 2015 films");
				expect(result.final_jeopardy.categories[0].answer).toEqual("Sylvester Stallone");

				done();
			});
		});

	});

	describe("parseJeopardySeason", () => {

		it("parses the list of games for a season", (done) => {
			fs.readFile("./spec/data/single_season.html", (err, data) => {
				if (err) {
					throw err;
				}

				const result = JeopardyParser.parseJeopardySeason(data.toString());
				const singleGame = result.games[0];
				expect(result.games.length).toBe(222);

				expect(singleGame.id).toEqual("5739");
				expect(singleGame.displayName).toEqual("#7577, aired 2017-07-18");

				done();
			});	
		});

	});

	describe("parseSeasonList", () => {

		it("parses the list of seasons available on the site", (done) => {
			fs.readFile("./spec/data/season_list.html", (err, data) => {
				if (err) {
					throw err;
				}

				const result = JeopardyParser.parseSeasonList(data.toString());

				expect(result.seasons.length).toBe(35);

				expect(result.seasons[0].id).toEqual("33");
				expect(result.seasons[0].sortNumber).toEqual(0); // ids are strings so give a different sort value
				expect(result.seasons[0].displayName).toEqual("Season 33");

				done();
			});	
		});

	});


});