require("dotenv").config({ path: "./env." + process.env.NODE_ENV });
const request = require("request");
const TestHelper = require("./helpers/TestHelper");
const baseUrl = "http://localhost:3001/";
//const SECRET = process.env.SECRET;

describe("API", function() {

		
	it("should reject inappropriate requests via the auth decorator", (done) => {
		TestHelper.createGame().then((game) => {
			request(baseUrl + "games/" + game.id, (error, response, body) => {
				expect(body).toContain("Error: Error: not authorized");
				done();
			});

		});
	});


});