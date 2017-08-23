require("dotenv").config({ path: "./env." + process.env.NODE_ENV });
const request = require("request");
const TestHelper = require("./helpers/TestHelper");
const sha1 = require("sha1");
const baseUrl = "http://localhost:3001/";
const SECRET = process.env.SECRET;

const getRequestUrlWithHash = function(route) {
	const time = Date.now();
	// this is from huarte/app/util/api.js verbatim
	const urlWithSecret = baseUrl + route + SECRET + time;
	const hash = sha1(urlWithSecret);
	const fullUrl = baseUrl + route + "?time=" + time + "&hash=" + hash;
	return fullUrl;
};


describe("API", function() {
		
	it("should reject inappropriate requests via the auth decorator", (done) => {
		TestHelper.createGame().then((game) => {
			request(baseUrl + "api/games/" + game.id, (error, response, body) => {
				expect(body).toContain("Error: Error: not authorized");
				done();
			});

		});
	});

	it("should return a single game from the games/:id route ", (done) => {
		TestHelper.createGame().then((game) => {
			request(getRequestUrlWithHash("api/games/" + game.id), (error, response, body) => {
				const jsonResponse = JSON.parse(body);
				expect(jsonResponse.id).toEqual(game.id);
				expect(jsonResponse.jeopardy).toBeTruthy();
				done();
			});
		});
	});	

	//FIXFIX: need error handling and negative test (if game/season doesn't exist in DB)

	it("should return all games from a season from the seasons/:id route", (done) => {
		TestHelper.createGame().then((game) => {
			request(getRequestUrlWithHash("api/seasons/" + game.season), (error, response, body) => {
				const jsonResponse = JSON.parse(body);
				expect(Object.keys(jsonResponse.games).length).toEqual(1);
				done();
			});
		});
	});

	it("should return all seasons from the / route", (done) => {
		TestHelper.createSeasons().then((seasons) => {
			request(getRequestUrlWithHash("api/"), (error, response, body) => {
				const jsonResponse = JSON.parse(body);
				expect(Object.keys(jsonResponse.seasons).length).toEqual(seasons.seasons.length);
				done();
			});
		});
	});

	it("should return ok and save the dispute from the /dispute route (POST)", (done) => {
		request({
			url: getRequestUrlWithHash("api/dispute/"),
			method: "POST",
			json: true,
			headers: {
				"content-type": "application/json",
			},
			body: {clue: { value: "$800", question: "Some question", answer: "An answer", isDailyDouble: false}, userAnswer: "Close to the answer but not quite"}
		}, (error, response, body) => {
			expect(body.status).toEqual("ok");
			done();
		});
	});

});