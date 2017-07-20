var cheerio = require("cheerio");

var JeopardyParser = {

	parseAnswerFromMouseoverHandler: function($, $clue, startString) {
		if (!$clue.find) {
			return;
		}
		var mouseoverHandler = $clue.find("div").first().attr("onmouseover");

		if (!mouseoverHandler) {
			return;
		}
		var startOfAnswer = mouseoverHandler.indexOf(startString);
		var endOfAnswer = mouseoverHandler.indexOf("</em>");
		var answer = mouseoverHandler.slice(startOfAnswer + startString.length, endOfAnswer);
		answer = $("<p>" + answer + "</p>").text(); //some answers have html for display in them, we don't want that
		return answer
	},

	parseMedia: function($, $clue) {
		var media = [];

		$clue.find(".clue_text a").each(function(index, element) {
			var mediaObject = {};
			mediaObject.url = $(element).attr("href");

			var extension = mediaObject.url.slice(mediaObject.url.lastIndexOf(".") + 1);
			var MEDIA_TYPES = {
				"png": "image",
				"jpg": "image",
				"mp3": "audio"
			}
			var type = MEDIA_TYPES[extension];

			if (!type) 	{
				return;
			}

			mediaObject.type = type;

			media.push(mediaObject);
		});

		return media;
	},

	parseJeopardySubgame: function($, jeopardyDiv, dollarAmountDelta){
		var game = {};
		var categoryOrder = {};
		var highestDollarAmount = 0;

		game.categories = [];
		//parse categories
		jeopardyDiv.find(".category_name").each((index, element) => {
			var categoryTitle = $(element).text().trim();
			var newCategory = {
				name: categoryTitle,
				clues: []
			};
			game.categories.push(newCategory);
			categoryOrder[index] = categoryTitle;
		});

		jeopardyDiv.find(".clue").each((index, element) => {
			var value = $(element).find(".clue_value").text().trim();
			var isDailyDouble = false;

			if (value && parseInt(value.slice(1)) > highestDollarAmount) {
				highestDollarAmount = parseInt(value.slice(1));
			}

			var columnIndex = index % 6;
			// if no value, it's a daily double. We can use gameName and the previous clue's value to figure it out (daily double will never be first in a category)
			if (!value) {
				var numberOfClues = game.categories[columnIndex].clues.length;
				var previousClue = game.categories[columnIndex].clues[numberOfClues - 1];
				var previousValue = 0;
				if (!previousClue) { // lowest row in the column
					if (columnIndex === 0 ) {
						return; //FIXFIX:  daily double in first row, first column
					}

					previousClue = game.categories[columnIndex - 1].clues[numberOfClues];

					if (!previousClue) {
						return;
					}

					value = previousClue.value.slice(1);
				} else {
					previousValue = previousClue.value;
					previousValue = previousValue.slice(1);
					value = parseInt(previousValue) + dollarAmountDelta;

				}

				isDailyDouble = true;
				value = "$" + value;
			}

			var question = $(element).find(".clue_text").text().trim();

			if (!question) { // some games are just missing data
				return;
			}

			//j-archive shows the answer via an onmouseover handler, we need to parse it out to figure out the actual answer
			var answer = this.parseAnswerFromMouseoverHandler($, $(element), '"correct_response">');

			if (!answer) {
				return;
			}

			var media = this.parseMedia($, $(element));

			var fullQuestionObject = {
				value: value,
				question: question,
				answer: answer,
				media: media,
				isDailyDouble: isDailyDouble
			};

			game.categories[columnIndex].clues.push(fullQuestionObject);

		});

		game.highestDollarAmount = highestDollarAmount
		return game;
	},

	parseFinalJeopardy: function($){
		var result = {};
		var categoryName = $(".final_round .category").text().trim();
		var question = $(".final_round .clue_text").text().trim();
		var answer = this.parseAnswerFromMouseoverHandler($, $(".final_round .category"), '\\"correct_response\\">');
		return {
			categories: [{
				name: categoryName,
				question: question,
				answer: answer
			}]
		};
	},

	parseJeopardyGame: function(html){
		var $ = cheerio.load(html);
		var gameTitle = $("#game_title").text().trim();
		var titleTokens = gameTitle.split("-");

		var isNewValueGame = $("#double_jeopardy_round:contains($2000)").length > 0;
		var dollarAmountDelta;

		if (isNewValueGame) {
			dollarAmountDelta = 200;
		} else {
			dollarAmountDelta = 100;
		}

		var jeopardy = this.parseJeopardySubgame($, $("#jeopardy_round"), dollarAmountDelta);
		var doubleJeopardy = this.parseJeopardySubgame($, $("#double_jeopardy_round"), 2 * dollarAmountDelta);
		var finalJeopardy = this.parseFinalJeopardy($);

		return {
			"show_number": titleTokens[0].trim(),
			"air_date": titleTokens[1].trim(),
			"jeopardy": jeopardy,
			"double_jeopardy": doubleJeopardy,
			"final_jeopardy": finalJeopardy
		};
	},

	parseJeopardySeason: function(html) {
		var $ = cheerio.load(html);
		
		var seasonsTable = $("#content table");
		var games = [];

		seasonsTable.find("tr").each(function(index, element) {
			var gameIdParam = "?game_id=";
			var url = $(element).find("td a").first().attr("href");
			var gameIdIndex = url.lastIndexOf(gameIdParam);
			var id = url.slice(gameIdIndex + gameIdParam.length);
			var displayName = $(element).find("td").first().text().trim();
			var newGame = {id: id, displayName: displayName};
			games.push(newGame);
		});

		return {
			games: games
		};
	},

	parseSeasonList: function(html) {
		var $ = cheerio.load(html)

		var seasonsTable = $("#content table");
		var seasons = [];
		var counter = 0;

		seasonsTable.find("tr").each(function(index, element) {
			var seasonIdParam = "?season=";
			var url = $(element).find("td a").first().attr("href");
			var gameIdIndex = url.lastIndexOf(seasonIdParam);
			var id = url.slice(gameIdIndex + seasonIdParam.length);
			var displayName = $(element).find("td").first().text().trim();
			var newSeason = { id: id, displayName: displayName , sortNumber: counter};
			counter = counter + 1;
			seasons.push(newSeason);
		});

		return {
			seasons
		};

	}

}

module.exports = JeopardyParser;