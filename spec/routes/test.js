const express = require("express");
const fs = require("fs");
let router = express.Router();

router.get("/game/*", function(req, res) {
	fs.readFile("./spec/data/show_7574.html", (err, data) => {
		res.send(data);
	});
});

router.get("/list_of_seasons/", function(req, res) {
	fs.readFile("./spec/data/season_list.html", (err, data) => {
		res.send(data);
	});	
});

router.get("/season/*", function(req, res) {
	fs.readFile("./spec/data/single_season.html", (err, data) => {
		res.send(data);
	});
});

module.exports = router;