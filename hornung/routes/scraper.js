var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var router = express.Router();

var mongoose = require('mongoose');


var parseAnswerFromMouseoverHandler = function($clue, startString){
		var mouseoverHandler = $clue.find("div").first().attr("onmouseover");
		var startOfAnswer = mouseoverHandler.indexOf(startString);
		var endOfAnswer = mouseoverHandler.indexOf("</em>")
		var answer = mouseoverHandler.slice(startOfAnswer + startString.length, endOfAnswer);
		return answer
};

var parseJeopardySubgame = function($, jeopardyDiv){
	var game = {};
	var categoryOrder = {};
	game.categories = [];
	//parse categories
	jeopardyDiv.find(".category_name").each(function(index, element){
		var categoryTitle = element.children[0].data;
		var newCategory = {
			name: categoryTitle,
			clues: []
		};
		game.categories.push(newCategory);
		categoryOrder[index] = categoryTitle;
	});

	jeopardyDiv.find(".clue").each(function(index, element){
		var value = $(element).find(".clue_value").text().trim();
		var columnIndex = index % 6;
		var categoryName = categoryOrder[columnIndex];

		var question = $(element).find(".clue_text").text().trim();

		//j-archive shows the answer via an onmouseover handler, we need to parse it out to figure out the actual answer
		var answer = parseAnswerFromMouseoverHandler($(element), '"correct_response">');

		var fullQuestionObject = {
			value: value,
			question: question,
			answer: answer
		};

		game.categories[columnIndex].clues.push(fullQuestionObject);

	});


	return game;
};

var parseFinalJeopardy = function($){
	var result = {};
	var categoryName = $(".final_round .category").text().trim();
	var question = $(".final_round .clue_text").text().trim();
	var answer = parseAnswerFromMouseoverHandler($(".final_round .category"), '\\"correct_response\\">');
	return {
		categories: [{
			name: categoryName,
			question: question,
			answer: answer
		}]
	};
}

var parseJeopardyGame = function(html){
	var $ = cheerio.load(html);
	var gameTitle = $("#game_title").text().trim();
	var titleTokens = gameTitle.split("-");

	var jeopardy = parseJeopardySubgame($, $("#jeopardy_round"));
	var doubleJeopardy = parseJeopardySubgame($, $("#double_jeopardy_round"));
	var finalJeopardy = parseFinalJeopardy($);

	return {
		"show_number": titleTokens[0].trim(),
		"air_date": titleTokens[1].trim(),
		"jeopardy": jeopardy,
		"double_jeopardy": doubleJeopardy,
		"final_jeopardy": finalJeopardy
	};
}

//
// List of Games per season
//

var parseJeopardySeason = function(html) {
	var $ = cheerio.load(html);
	
	var seasonsTable = $("#content table");
	var games = [];

	seasonsTable.find("tr").each(function(index, element) {
		var newGame = {};
		var gameIdParam = "?game_id=";
		var url = $(element).find("td a").first().attr("href");
		var gameIdIndex = url.lastIndexOf(gameIdParam);
		newGame.id = url.slice(gameIdIndex + gameIdParam.length);
		newGame.displayName = $(element).find("td").first().text().trim();
		games.push(newGame);
	});

	return {
		games: games
	};
};

//
// List of Seasons (top-level menu)
//

var parseSeasonList = function(html) {
	var $ = cheerio.load(html)

	var seasonsTable = $("#content table");
	var seasons = [];

	seasonsTable.find("tr").each(function(index, element) {
		var newSeason = {};
		var seasonIdParam = "?season=";
		var url = $(element).find("td a").first().attr("href");
		var gameIdIndex = url.lastIndexOf(seasonIdParam);
		newSeason.id = url.slice(gameIdIndex + seasonIdParam.length);
		newSeason.displayName = $(element).find("td").first().text().trim();
		seasons.push(newSeason);
	});

	return {
		seasons: seasons
	};

};

router.get('/games/:id', function(req, res) {

	var id;
	if (!req.params.id) {
		id = "5002";
	} else {
		id = req.params.id;
	}

	var url = "http://www.j-archive.com/showgame.php?game_id=" + id;

	request(url, function(error, response, html){
		if(!error){
			res.json(parseJeopardyGame(html));
		}
		else{
			console.log(error);
		}

	});
});

router.get("/seasons/:id", function(req, res) {
	var url = "http://www.j-archive.com/showseason.php?season=" + req.params.id;

	request(url, function(error, response, html) {
		if (!error) {
			res.json(parseJeopardySeason(html));
		} else {
			console.log(error);
		}
	});
});

router.get("/", function(req, res) {
	var url = "http://j-archive.com/listseasons.php";

	request(url, function(error, response, html) {
		if (!error) {
			res.json(parseSeasonList(html));
		} else {
			console.log(error);
		}
	});

});


module.exports = router;