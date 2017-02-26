var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var api = require('./routes/api');
var sha1 = require('sha1');

var app = express();
const SECRET = "DEFINITELY_NOT_USING_THIS_IN_PRODUCTION";

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

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
  let error;
  const hash = req.query.hash;
  const time = req.query.time;
  const fullUrl = req.protocol + "://" + req.hostname + ":3000" + req.path + SECRET + time; //FIXFIX: this won't work in production
  const shaResult = sha1(fullUrl);
  const hasValidTime = isTimeValid(time, Date.now())
  if (shaResult !== hash || !hasValidTime) {
    error = new Error("Error: not authorized");
    error.status = 403;
    next(error);
  }
  next();
};

app.use(authMiddleware);

app.use('/', routes);
app.use('/api', api);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});



// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});




module.exports = app;
