var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var router = express.Router();

var mongoose = require('mongoose');


var parseAnswerFromMouseoverHandler = function($clue, startString){
		var mouseoverHandler = $clue.find("div").first().attr("onmouseover");
		var startOfAnswer = mouseoverHandler.indexOf(startString);
		var endOfAnswer = mouseoverHandler.indexOf("</em>")
		console.log(startOfAnswer, startString.length, endOfAnswer);
		var answer = mouseoverHandler.slice(startOfAnswer + startString.length, endOfAnswer);
		return answer
};

var parseJeopardySubgame = function($, jeopardyDiv){
	var game = {};
	var categoryOrder = {};
	//parse categories
	jeopardyDiv.find(".category_name").each(function(index, element){
		var categoryTitle = element.children[0].data;
		game[categoryTitle] = {};
		categoryOrder[index] = categoryTitle;
	});

	jeopardyDiv.find(".clue").each(function(index, element){
		var value = $(element).find(".clue_value").text().trim();
		var columnIndex = index % 6;
		var categoryName = categoryOrder[columnIndex];

		var question = $(element).find(".clue_text").text().trim();

		//j-archive shows the answer via an onmouseover handler, we need to parse it out to figure out the actual answer
		var answer = parseAnswerFromMouseoverHandler($(element), '"correct_response">');

		game[categoryName][value] = {
			"question": question,
			"answer": answer
		};

	});


	return game;
};

var parseFinalJeopardy = function($){
	var result = {};
	var categoryName = $(".final_round .category").text().trim();
	var question = $(".final_round .clue_text").text().trim();
	var answer = parseAnswerFromMouseoverHandler($(".final_round .category"), '\\"correct_response\\">');
	return {
		category: categoryName,
		question: question,
		answer: answer
	}
}

router.get('/', function(req, res) {

	var url = "http://www.j-archive.com/showgame.php?game_id=5002";

	request(url, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);
			var gameTitle = $("#game_title").text().trim();
			var titleTokens = gameTitle.split("-");

			var jeopardy = parseJeopardySubgame($, $("#jeopardy_round"));
			var doubleJeopardy = parseJeopardySubgame($, $("#double_jeopardy_round"));
			var finalJeopardy = parseFinalJeopardy($);

			res.json({
				"show_number": titleTokens[0].trim(),
				"air_date": titleTokens[1].trim(),
				"jeopardy": jeopardy,
				"double_jeopardy": doubleJeopardy,
				"final_jeopardy": finalJeopardy
			});
		}
		else{
			console.log(error);
		}

	});
});


module.exports = router;