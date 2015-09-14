var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var router = express.Router();

var mongoose = require('mongoose');


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
		game[categoryName][value] = "this is a question";

		var question = $(element).find(".clue_text").text().trim();

		//j-archive shows the answer via an onmouseover handler, we need to parse it out to figure out the actual answer
		var mouseoverHandler = $(element).find("div").first().attr("onmouseover");
		var startString = '"correct_response">';
		var startOfAnswer = mouseoverHandler.indexOf(startString);
		var endOfAnswer = mouseoverHandler.indexOf("</em>")
		var answer = mouseoverHandler.slice(startOfAnswer + startString.length, endOfAnswer);
		game[categoryName][value] = {
			"question": question,
			"answer": answer
		};

	});


	return game;
};

router.get('/', function(req, res) {

	var url = "http://www.j-archive.com/showgame.php?game_id=5002";

	request(url, function(error, response, html){
		if(!error){
			var $ = cheerio.load(html);
			var gameTitle = $("#game_title").text().trim();
			var titleTokens = gameTitle.split("-");


			var jeopardy = parseJeopardySubgame($, $("#jeopardy_round"));

			res.json({
				"show_number": titleTokens[0].trim(),
				"air_date": titleTokens[1].trim(),
				"jeopardy": jeopardy
			});
		}
		else{
			console.log(error);
		}

	});
});


module.exports = router;