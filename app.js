const alertNode         = require('alert-node');
const async             = require('async');
const bodyParser        = require('body-parser');
const cookieParser      = require('cookie-parser');
const con               = require('./routes/con');
const env               = process.env.NODE_ENV || 'development';
const config            = require('./config/config')[env];
const crypto            = require('crypto');
const express           = require('express');
const app               = express();
const expressValidator  = require('express-validator');
const favicon           = require('serve-favicon');
const flash             = require('express-flash');
const gulp              = require('gulp');
const nodemon           = require('gulp-nodemon');
const logger            = require('morgan');
const nodemailer        = require('nodemailer');
const moment            = require('moment');
app.locals.moment       = require('moment');
const passport          = require('passport');
const passportLocal     = require('passport-local').Strategy;
const path              = require('path');
const session           = require('express-session');
const BetterMemoryStore = require('session-memory-store')(session);
const sgMail            = require('@sendgrid/mail');
const sgApiKey          = sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const Store             = require('express-session').Store;
const store             = new BetterMemoryStore({ expires: 60 * 60 * 1000, debug: true });
const qrcode            = require('qrcode');
const speakeasy         = require('speakeasy');
const auth              = require('./routes/auth');
const index             = require('./routes/index');
const users             = require('./routes/users');
const students          = require('./routes/students');
const students_filter   = require('./routes/students-filter');
const models            = require('./models');
const user              = models.user;

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressValidator());
app.use(session( {
  name: 'JSESSION',
  secret: 'MYSECRETISVERYSECRET',
  store: store,
  resave: true,
  saveUninitialized: true
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

models.sequelize.sync().then(function() {
  console.log('Nice! Database looks fine.')
}).catch(function(err) {
  console.log('Something went wrong..')
});

passport.use('local', new passportLocal( {
  usernameField: 'username',
  passwordField: 'password',
  passReqToCallback: true 
}, function (req, username, password, done) {
  if (!username || !password) {
    alertNode('All fields are required.');
    return done(null, false);
  }
  user.findOne({
    where: {
      username: username
    }
  }).then(function(user) {
    if(!user) {
      alertNode('Invalid username or password');
    } 
    var salt = config.salt.salt+''+password;
    var encPassword = crypto.createHash('sha1').update(salt).digest('hex');
    var dbPassword = user.password;
    if (!(dbPassword == encPassword)) {
      alertNode('Invalid username or password.');
      return done (null, false);
    }
    var userinfo = user.get();
    return done (null, userinfo);
  }).catch(function(err) {
    console.log('Error:', err);
  });
}));

passport.serializeUser(function(user, done) {
  done (null, user.id);
});

passport.deserializeUser(function(id, done) {
  user.findById(id).then(function(user) {
    if(user) {
      done(null, user.get());
    } else {
      done(user.errors, null);
    }
  });
});

function isAuthenticated(req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/login');
}

app.use('/', auth);
app.use('/', isAuthenticated, index);
app.use('/students', isAuthenticated, students);
app.use('/filter', isAuthenticated, students_filter);
app.use('/users', isAuthenticated, users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
