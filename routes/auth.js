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
const speakeasy         = require('speakeasy');
const twofa             = require('node-2fa');
const models            = require('../models');
const User              = models.user;
const usersjoi          = require('../joi/users');

router.get('/login', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('login');
  }
});
  
router.get('/sign-in', function(req, res, next) {
  passport.authenticate('local', function(err, user, info) {
    //console.log(req.query.username);
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/login');
    }
    User.findOne({
      where: {
        username: req.query.username
      }
    }).then(function(users) {
      //console.log(users.username);
      //console.log(users.twofa);
      if(users.twofa == 'disable') {
        // successRedirect : '/'
        // failureRedirect : '/login'
        // failureFlash : true
        req.login(user, function(err) {
          if (err) return next(err);
          return res.redirect('/');
        })
      } else {
        req.flash('username', req.query.username);
        console.log(req.query.username);
        res.redirect('/two-factor-authentication');
      }
    })
    // successRedirect : '/',
    // failureRedirect : '/login',
    // failureFlash : true
  })(req, res, next)
});
  
router.get('/two-factor-authentication', function(req, res) {
  var f = req.flash('username');
  console.log(f);
  console.log(f.toString());
  res.render('two-fa', { username: f.toString() });
});

router.post('/two-factor-authentication', function(req, res) {
  console.log(req.body.username)
  User.findOne({
    where :{
      username: req.body.username
    }
  }).then(function(users) {
    var verifyToken = twofa.verifyToken(users.twofa_secret, req.body.token);
    console.log(req.body.token);
    var newToken = twofa.generateToken(users.twofa_secret)
    console.log(newToken);
    if(verifyToken !== null) {
      User.findOne({
        where: {
          username: req.body.username
        },
        attributes: ['id', 'username', 'password']
      }).then(user => 
        req.login(user, function (error) {
          if (error) {
            req.flash('error', error.message);
            console.log('user', user);
            return res.redirect('back');
          }
          console.log('berhasil');
          console.log('username', req.user.username);
          return res.redirect('/');
        })
      )
    } else {
      req.flash('failed', 'Wrong token!');
      res.render('two-fa', { 'error': req.flash('failed'), token: req.body.token, username: req.body.username });
    }
  }).catch(error => {
    req.flash('failed', 'Wrong token!');
    res.render('two-fa', { 'error': req.flash('failed'), token: req.body.token, username: req.body.username });
  })
})

router.get('/setting', function (req, res) {
  if (req.isAuthenticated()) {
    User.findOne({
      where : {
        username: req.user.username
      }
    }).then(function(user) {
      res.render('setting', { stwofa: user.twofa });
      console.log(user.twofa);
    })
  } else {
    res.render('login');
  }
});

router.post('/setting', function(req, res) {
  console.log(req.body.twofa);
  if(req.body.twofa == 'disable') {
    User.update({
      twofa: 'disable'
    }, {
      where: {
        username: req.user.username
      }
    }).then(function(user) {
      req.flash('success', 'Two factor authenticate is disabled.')
      res.render('setting', { stwofa: req.body.twofa, 'valid': req.flash('success') });
    })
  } else if (req.body.twofa == 'enable') { 
    User.findAll({
      where: {
        username: req.user.username
      }
    }).then(function(user) {
      if (user.twofa == 'enable') {
        var newToken = twofa.generateToken(user.twofa_secret)
        console.log(newToken);
        var newSecret = user.twofa_secret;
        req.flash('code', newSecret);
        res.render('setting', { 'enable': req.flash('code'), qr_code: user.qr_url, stwofa: req.body.twofa });
      } else {
        var nSecret = twofa.generateSecret({ name: 'Student App', account: req.user.username });
        var newToken = twofa.generateToken(nSecret.secret);
        console.log(newToken);
        User.update({
          twofa_secret: nSecret.secret,
          qr_url: nSecret.qr
        } , {
          where: {
            username: req.user.username
          }
        }).then(function(user) {
          User.findOne({
            where: {
              username: req.user.username
            }
          }).then(function(user) {
            var newSecret = user.twofa_secret;
            req.flash('code', newSecret);
            res.render('setting', { 'enable': req.flash('code'), qr_code: nSecret.qr, stwofa: req.body.twofa });
          })
        })
      }
    })
  }
});

router.get('/verify', function (req, res) {
  User.findOne({
    where : {
      username: req.user.username
    }
  }).then(function(user) {
    var verifyToken = twofa.verifyToken(user.twofa_secret, req.query.token);
    console.log(user.twofa_secret)
    console.log(req.query.token)
    if (verifyToken !== null) {
      //alertNode('Valid token.')
      req.flash('valid', 'Valid token.')
      req.flash('code', user.twofa_secret)
      res.render('setting', { 'valid': req.flash('valid'), stwofa: 'enable', 'enable': req.flash('code'), qr_code: user.qr_url, token: req.query.token });
    } else {
      //alertNode('Wrong token!')
      req.flash('failed', 'Wrong token!')
      req.flash('code', user.twofa_secret)
      res.render('setting', { 'failed': req.flash('failed'), stwofa: 'disable', 'disable': req.flash('code'), qr_code: user.qr_url, token: req.query.token });
    }
    console.log(twofa.verifyToken(user.twofa_secret, req.body.token));
  })
})

router.post('/verify', function (req, res) {
  User.update({
    twofa: 'enable'
  }, { 
    where : {
      username: req.user.username
    }
  }).then(function(user) {
    req.flash('success', 'Horray! Two factor authentication is enabled.')
    res.render('setting', { 'valid': req.flash('success'), stwofa: 'enable' })
  })
})

router.get('/register', function (req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('register');
  }
});

router.post('/register', function(req, res, next) {
  usersjoi.validate({ username: req.body.username, email: req.body.email }, function(err, value) {
    if(err) {
      req.flash('error', err)
      res.render('register', { susername: req.body.username, semail: req.body.email, 'error': req.flash('error') })
    } else {
      async.waterfall([
        function(done) {
          crypto.randomBytes(20, function(err, buf) {
            var token = buf.toString('hex');
            done(err, token);
          });
        },
        function(token, done) {
          var username = req.body.username;
          var email = req.body.email;
          var pwdExp = new moment().add(10, 'm').toDate();
          var insertUsers = {
            username: req.body.username,
            email: req.body.email,
            email_token: token,
            token_exp: pwdExp
          };
          User.findAll({
            where: {
              username: username,
              email: email
            }
          }).then(function(user, err) {
            if (!user) {
              req.flash('error', 'This username or email is already used!');
              return res.redirect('/register');
            } else {
              User.create(insertUsers)
              .then(function(user, err) {
                done(err, token, user);
              });
            }
          });
        },
        function(token, user, done) {
          const msgReg = {
            to: req.body.email,
            from: config.message_register.from,
            subject: config.message_register.subject,
            text: config.message_register.text + req.headers.host + config.message_register.register + token + config.message_register.text2,
            html: config.message_register.html + req.headers.host + config.message_register.reghtml + token + config.message_register.html2,
          };
          sgMail.send(msgReg, function(err) {
            req.flash('info', 'An email has been sent to ' + req.body.email + ' with further instructions.');
            done(err, 'done');
          });
        }
      ], function(err) {
        if (err) return next(err);
        res.render('register');
      });
    }
  });
});

router.get('/register/:token', function(req, res) {
  User.findOne({
    where: {
      email_token: req.params.token
    }
  }).then(function(user, err) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/register');
    } else {
      res.render('complete-register', { susername: user.username, semail: user.email });
    }
  }).catch(function(err) {
    console.log(err);
  })
});

router.post('/register/:token', function(req, res, next) {
  usersjoi.validate({ password: req.body.password }, function(err, value) {
    if (err) {
      req.flash('error', err);
    }
    var email = req.body.email;
    var password = req.body.password;
    var pass = config.salt.salt+''+password;
    var pwd = crypto.createHash('sha1').update(pass).digest('hex')
    var email_token = null;
    var token_exp = null;
    User.update({
      password: pwd,
      email_token: email_token,
      token_exp: token_exp,
      twofa: 'disable'
    }, {
      where: {
        email: email
      }
    }).then(users =>
      User.findOne({
        where: {
          username: req.body.username
        }
      }).then(user =>
        req.login(user, function (err) {
          if(err) {
            req.flash('error', err.message);
            console.log('user', user);
            return res.redirect('back');
          }
          console.log('berhasil');
          req.flash('success', 'Success! Your password has been set.');
          res.redirect('/');
        })
      )
    );
  });
});

router.get('/', function(req, res) {
  if (req.isAuthenticated()) {
    res.render('index');
  } else {
    res.render('login');
  }
  //res.render('index');
  //console.log(req.user.username);
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
          done(err, token);
        });
      },
      function(token, done) {
        User.findOne({
          where: {
            email: req.body.email
          }
        }).then(function(user, err) {
          if (!user) {
            req.flash('error', 'No account with that email address exists.');
            return res.redirect('/forgot');
          } else {
            var pwdExp = new moment().add(10, 'm').toDate();
            User.update({
              email_token: token,
              token_exp: pwdExp
            }, {
              where: {
                email: req.body.email
              }
            }).then(function(user, err) {
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
      User.findOne({
        where: {
          email_token: req.params.token
        }
      }).then(function(user, err) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('/forgot');
        }
        var email = user.email;
        var password = req.body.password;
        var pass = config.salt.salt+''+password;
        var pwd = crypto.createHash('sha1').update(pass).digest('hex')
        var email_token = null;
        var token_exp = null;
        User.update({
          password: pwd,
          email_token: email_token,
          token_exp: token_exp
        }, {
          where: {
            email: email
          }
        }).then(function(err) {
          if(err) {
            throw err;
          } else {
            req.flash('success', 'Success! Your password has been changed.');
          }
        });
        User.findAll({
          where: {
            email: user.email
          }
        }).then(function(user, err) {
          done(err, user);
        });
      });
    },
    function(user, done) {
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
    if (err) console.log(err);
    res.redirect('/reset');
  })
})

module.exports = router;
