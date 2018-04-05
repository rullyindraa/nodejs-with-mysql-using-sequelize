const con               = require('./con');
const env               = process.env.NODE_ENV || 'development';
const config            = require('../config/config')[env];
const express           = require('express');
const app               = express();
const moment            = require('moment');
app.locals.moment       = require('moment');
const router            = express.Router();

router.get('/', function(req, res) {
    var keywords = req.query.keywords;
    var orderby = req.query.orderby;
    var sort = req.query.sort;
    var q = "SELECT * FROM students where ?? like concat('%', ? ,'%') order by ?? ";
    con.query(q+sort, [orderby, keywords, orderby],function(err, rows, fields) {
      if (err) {
        console.log(err);
      } else {
        console.log(rows);
        res.render('student-list', {title: 'Student List', data: rows});
      }
    });
  });
  
  module.exports = router;