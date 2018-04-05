const express       = require('express');
const router        = express.Router();
const alertNode     = require('alert-node');
const crypto        = require('crypto');
const expressValidator  = require('express-validator');
const con           = require('./con');
const env           = process.env.NODE_ENV || 'development';
const config        = require('../config/config')[env];

router.get('/input', function(req, res) {
  res.render('input-user', {'error' : req.flash('error')});
});

router.post('/input', function(req, res) {
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
    res.render('input-user');
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
    con.query('select * from users where username = ? OR email = ?', [username, email], function(err, rows, fields) {
      if (err) {
      console.log(err);
      } else if (rows.length > 0) {
        alertNode('You entered duplicate username or email!');
      } else {
        con.query('INSERT INTO users set ? ', insertUsers, function(err, rows, fields) {
          if (err) {
            console.log(err);
          } else {
            console.log(rows);
          }
          res.redirect('/');
        });
      }
    });
  }
});

module.exports = router;
