const express = require('express'),
    path = require('path'),
    favicon = require('serve-favicon'),
    logger = require('morgan'),
    bodyparser = require('body-parser'),
    config = require('config'),


    api = require('./server/routes/api'),
    passport = require('passport'),
    session = require('express-session');


const models = require('./server/models');
const emailConfig = config.get('email');
models.connect(config.get('mongodb').url, emailConfig);

const nev = models.nev;

// dev server only
const webpackDevMiddleware = require('webpack-dev-middleware'),
    webpackHotMiddleware = require('webpack-hot-middleware'),
    webpack = require('webpack'),
    webpackDevConfig = require('./webpack.config');

const app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

if (app.get('env') === 'development') {
    app.use(logger('dev'));
    const compiler = webpack(webpackDevConfig);

    app.use(webpackDevMiddleware(compiler, {
        // this tells the middleware where to send assets in memory, so
        // if you're seeing 404's for assets it's probably because this isn't
        // set correctly in this middleware
        publicPath: webpackDevConfig.output.publicPath,
        hot: true
    }));

    app.use(webpackHotMiddleware(compiler, {
        reload: true // reload page when webpack gets stuck
    }));

} else app.use(logger('combined'));

app.use(bodyparser.urlencoded({
  extended: true
}));
app.use(bodyparser.json());
app.use(passport.initialize());


// app.use(express.static(path.join(__dirname, 'public')));

const localSignupStrategy = require('./server/passport/local-signup')(nev, emailConfig.sendTo).strategy;
const localLoginStrategy = require('./server/passport/local-login');
const jwtStrategy = require('./server/passport/jwt');

passport.use('local-signup', localSignupStrategy);
passport.use('local-login', localLoginStrategy);
passport.use('jwt', jwtStrategy);

const authCheckMiddleware = require('./server/middleware/auth-check');


app.use(express.static(path.join(__dirname, 'public', 'static')));
app.use(express.static('./client/dist/'));
const authRoutes = require('./server/routes/auth')(nev);
app.use('/auth', authRoutes.router);
app.use('/api', [authCheckMiddleware, api]);

// app.use('/exploreat-v3/api', api);

app.use('/', [authCheckMiddleware, express.static(path.join(__dirname, 'public'))]);

// catch 404 and forward to error handler
// app.use(function(req, res, next) {
//     res.status(404).send("Sorry can't find that!");
// });

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Always return the main index.html, so react-router render the route in the client
app.get('*', (req, res) => {
    console.log('Sending index.html');
   res.sendFile(path.resolve(__dirname, 'public', 'static', 'index.html'));
});

// error handlers

// // development error handler
// // will print stacktrace
// if (app.get('env') === 'development') {
//   app.use(function(err, req, res, next) {
//     res.status(err.status || 500);
//     res.render('error.ejs', {
//       message: err.message,
//       error: err
//     });
//   });
// }
//
// // production error handler
// // no stacktraces leaked to user
// app.use(function(err, req, res, next) {
//   res.status(err.status || 500);
//   res.render('error.ejs', {
//     message: err.message,
//     error: {}
//   });
// });


module.exports = app;
