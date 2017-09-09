require("dotenv").config({ path: "./env." + process.env.NODE_ENV });
var express = require("express");
var path = require("path");
var logger = require("morgan");
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");

const api = require("./routes/api");
const sha1 = require("sha1");
const testRoutes = require("./spec/routes/test");

var app = express();
const SECRET = process.env.SECRET;
const BASE_URL = process.env.BASE_URL;

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

const isTimeValid = (requestTime, currentTime) => {
	let fiveMinutesAgo = new Date(currentTime);
	fiveMinutesAgo = fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
	let fiveMinutesFromNow = new Date(currentTime);
	fiveMinutesFromNow = fiveMinutesFromNow.setMinutes(fiveMinutesFromNow.getMinutes() + 5);
	if (requestTime < fiveMinutesAgo  || requestTime > fiveMinutesFromNow) {
		return false;
	}
	return true;
};

// auth - if they don't send us the right hash, reject the request!
const authMiddleware = (req, res, next) => {
	if (req.path.includes("/test/")) {
		next();
		return;
	}

	let error;
	const hash = req.query.hash;
	const time = req.query.time;
	const fullUrl = BASE_URL + req.path + SECRET + time; //FIXFIX: dev/productoin configuration
	const shaResult = sha1(fullUrl);
	const hasValidTime = isTimeValid(time, Date.now());
	if (shaResult !== hash || !hasValidTime) {
		error = new Error("Error: not authorized");
		error.status = 403;
		next(error);
	} else {
		next();
	}
};

app.use(authMiddleware);

app.use("/api", api);

//Routes used only by the tests
if (app.get("env") === "test") {
	app.use("/test", testRoutes);
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	var err = new Error("Not Found");
	err.status = 404;
	next(err);
});



// error handlers

// development error handler
// will print stacktrace

if (app.get("env") === "development") {
	app.use(function(err, req, res) {
		res.status(err.status || 500);
		res.render("error", {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res) {
	res.status(err.status || 500);
	res.render("error", {
		message: err.message,
		error: {}
	});
});


app.listen(3001, () => {
	console.log("Starting hornung server...");
});


process.title = "hornung"; // we use this to kill it in npm run posttest

module.exports = app;
