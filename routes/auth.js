const express           = require('express');
const router            = express.Router();
const passport          = require('passport');
const alertNode         = require('alert-node');
const async             = require('async');
const con               = require('./con');
const env               = process.env.NODE_ENV || 'development';
const config            = require('../config/config')[env];
const crypto            = require('crypto');
const expressValidator  = require('express-validator');
const flash             = require('express-flash');
const moment            = require('moment');
const sgMail            = require('@sendgrid/mail');
const sgApiKey          = sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const models            = require('../models');
const user              = models.user;

router.get('/login', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('login');
  }
});
  
router.post('/login', passport.authenticate('local', {
  successRedirect : '/',
  failureRedirect : '/login',
  failureFlash : true
}), function(req, res, info) {
  res.render('login', {'message' : req.flash('message')});
});

router.get('/sign-up', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('sign-up');
  }
});

router.post('/sign-up', function(req, res) {
  req.assert('username', 'Username is required').notEmpty();          
  req.assert('password', 'Password is required').notEmpty();
  req.assert("email", "Enter a valid email address.").isEmail()
  var errors = req.validationErrors();
  if (errors) {
    var error_message = '';
    errors.forEach(function (error) {
      error_message += error.msg + '\n'
    })
    alertNode(error_message);
    res.render('sign-up');
  } else {
    var password = req.body.password;
    var pass = config.salt.salt+''+password;
    var username = req.body.username;
    var email = req.body.email;
    var insertUsers = {
      username: req.body.username,
      email: req.body.email,
      password: crypto.createHash('sha1').update(pass).digest('hex')
    };

    user.findOne({
      where: {
        username: username,
        email: email
      }
    }).then(function(user) {
      if(user) {
        alertNode('You entered duplicate username or email!');
      } else {
        models.user.create(insertUsers)
        .then(newUser => {
          console.log(`New User ${newUser.username}, with id ${newUser.id} has been created.`);
          res.redirect('/');
        })
      }
    });
  }
});

router.get('/', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('login');
  }
});

router.get('/logout', function(req, res) {
  if(!req.isAuthenticated()) {
    notFound404(req, res, next);
  } else {
    req.logout();
    res.redirect('/login');
  }
});  
  
router.get('/forgot', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('forgot');
  }
});
  
router.post('/forgot', function(req, res, next) {
  req.assert("email", "Enter a valid email address.").isEmail()
  var errors = req.validationErrors();
  if (errors) {
    var error_message = '';
    errors.forEach(function (error) {
      error_message += error.msg + '\n'
    })
    req.flash('error', error_message);
    res.render('forgot');
  } else {
    async.waterfall([
      function(done) {
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString('hex');
          console.log(token);
          done(err, token);
        });
      },
      function(token, done) {
        var email = req.body.email;
        user.findOne({
          where: {
            email: email
          }
        }).then(function(err, user) {
          if(user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot');
          } else {
            var resetExp = new moment().add(10, 'm').toDate();
            var user = models.user;
            user.findOne({
              where : {
                email: email
              }
            }).then(user => {
              user.updateAttributes({
                reset_pwd_token: token,
                reset_pwd_exp: resetExp
              })
              done(err, token, user);
            });
          }
        });
      },
      function(token, user, done) {
        const msg = {
          to: [req.body.email],
          from: config.message_reset.from,
          subject: config.message_reset.subject,
          text: config.message_reset.text + req.headers.host + config.message_reset.reset + token + config.message_reset.text2,
          html: config.message_reset.html + req.headers.host + config.message_reset.resethtml + token + config.message_reset.html2,
        };
        sgMail.send(msg, function(err) {
          req.flash('info', 'An email has been sent to ' + req.body.email + ' with further instructions.');
          done(err, 'done');
        });
      }
    ], function(err) {
      if (err) return next(err);
      res.redirect('/forgot');
    });
  }
});
  
router.get('/reset/:token', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('reset');
  }
});
  
router.post('/reset/:token', function(req, res) {
  async.waterfall([
    function(done) {
      con.query('SELECT * FROM users WHERE reset_pwd_token = ?', [req.params.token], function(err, rows) {
        console.log(rows);
        if (!rows.length > 0) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('/forgot');
        }
        var email = rows[0].email;
        var password = req.body.password;
        var pass = config.salt.salt+''+password;
        var pwd = crypto.createHash('sha1').update(pass).digest('hex')
        var reset_pwd_token = undefined;
        var reset_pwd_exp = null;
  
        con.query('UPDATE users set password = ?, reset_pwd_token = ?, reset_pwd_exp = ? WHERE email = ?', [pwd, reset_pwd_token, reset_pwd_exp, email], function(err) {
          if(err) {
            throw err;
          } else {
            req.flash('success', 'Success! Your password has been changed.');
          }
          console.log(rows);
        });

        con.query("select * from users where email = '"+rows[0].email+"'", function(err, rows) {
          done(err, rows);
        });
      });
    },
    function(rows, done) {
      const msgReset = {
        to: [req.body.email],
        from: config.msg_reset_success.from,
        subject: config.msg_reset_success.subject,
        text: config.msg_reset_success.text + req.body.email + config.msg_reset_success.text2,
        html: config.msg_reset_success.html + req.body.email + config.msg_reset_success.html2,
      };
      sgMail.send(msgReset, function(err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err, 'done');
      });
    }
  ], function(err) {
    console.log(err);
    res.redirect('/reset');
  })
})

module.exports = router;
