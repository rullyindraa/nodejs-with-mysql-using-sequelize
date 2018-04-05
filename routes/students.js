const alertNode         = require('alert-node');
const con               = require('./con');
const env               = process.env.NODE_ENV || 'development';
const config            = require('../config/config')[env];
const express           = require('express');
const app               = express();
const flash             = require('express-flash');
const moment            = require('moment');
app.locals.moment       = require('moment');
const router            = express.Router();

//router.use(isAutheticated);

router.get('/', function(req, res) {
  var studentList = [];
  con.query('SELECT * FROM students', function(err, rows, fields) {
    if (err) {
      res.status(500).json({"status_code": 500,"status_message": "internal server error"});
    } else {
      res.render('student-list', {title: 'Student List', data: rows});
    }
  });
});

function gChartTranspose(original) {
  var transpose = [];
  for (var i = 0; i < original.length; ++i) {
    for (var j = 0; j < original[i].length; ++j) {
      if (original[i][j] === undefined) {
        continue;
      }
      if (transpose[j] === undefined) {
        transpose[j] = [];
      }
      transpose[j][i] = original[i][j];
    }
  }
  return transpose;
}
  
router.get('/statistics', function(req, res) {
  var tempMonthTotal = []; transMonth = []; getGender = []; getGenderCount = []; tempGenderCount = []; transGend = [];
  var q = 'select gender, count(gender) as gender_count from students group by gender';
  con.query(q, function(err, rows, fields) {
    if (err) {
      console.log(err)
    } else {
    getGender.push('gender')
    getGenderCount.push('gender_count')
      for (var j = 0; j < rows.length; j++) {
        if (rows[j].gender === 'F') {
          getGender.push('Female')
        } else {
          getGender.push('Male')
        }
        getGenderCount.push(rows[j].gender_count)
      }
      tempGenderCount.push(getGender, getGenderCount)
    }
    var transGend = gChartTranspose(tempGenderCount);
    console.log(transGend);
    var getMonth = ['month', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']; 
    var getTotal = ['Total', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; 
    var q = 'select month(admission_date) as month, count(id) as Total from students where year(admission_date) = '+[req.query.year]+' group by month(admission_date)';
    con.query(q, function(err, rows, fields) {
      if (err) {
        console.log(err)
      } else {
        for (var j = 0; j < rows.length; j++) {
          var month = rows[j].month;
          getTotal.fill(rows[j].Total, month, month+1)
        } 
        tempMonthTotal.push(getMonth, getTotal) 
      }
      var transMonth = gChartTranspose(tempMonthTotal);
      console.log(transMonth);
      res.render('statistics', { obj_gender: JSON.stringify(transGend), obj_student: JSON.stringify(transMonth) });
    })
  });
});

router.get('/input', (req, res) => 
    res.render('input-student.pug')
);

router.post('/input', function(req, res) {
  req.assert('name', 'Name is required').notEmpty();          
  req.assert('address', 'Address is required').notEmpty();
  req.assert('date_of_birth', 'Date is required').notEmpty();
  req.assert('student_email', 'Email is not Valid').isEmail();
  req.assert('major', 'Major is required').notEmpty();
  var errors = req.validationErrors();
  if (errors) {
    var error_message = '';
    errors.forEach(function (error) {
      error_message += error.msg + '\n'
    })
    alertNode(error_message);
  } else {
    var studentList = [];
    var insertStudent = {
      student_id: req.body.student_id,
      admission_date: req.body.admission_date,
      name: req.body.name,
      address: req.body.address,
      date_of_birth: req.body.date_of_birth,
      gender: req.body.gender,
      major: req.body.major,
      student_email: req.body.student_email
    };
    var student_id = req.body.student_id;
    var date_of_birth = req.body.date_of_birth;
    var today = new Date();
    var newtoday = moment(today).format('YYYY-MM-DD');
    
    con.query('select * from students where student_id = ?', student_id, function(err, rows, fields) {
      if (err) {
      console.log(err);
      } else if (rows.length > 0) {
        alertNode('You entered duplicate Student ID!');
      } else if (date_of_birth > newtoday) {
        alertNode("You can't enter date of birth in future!");
      } else {
        con.query('INSERT INTO students set ? ', insertStudent, function(err, rows, fields) {
          if (err) {
            console.log(err);
          } else {
            console.log(rows);
          }
          res.redirect('/students');
        });
      }
    });
  }
});

router.get('/:id', function(req, res) {
  con.query('SELECT * FROM students WHERE student_id = ?', [req.params.id], function(err, rows, fields) {
    if (err) throw err;
		if (rows.length <= 0) {
      res.redirect('/students')
    } else { 
      var student_admission_date = moment(rows[0].admission_date).format('YYYY-MM-DD');
      var studentDoB = moment(rows[0].date_of_birth).format('YYYY-MM-DD');
      res.render('edit-student', {
        id: rows[0].id,
        student_id: rows[0].student_id,
        admission_date: student_admission_date,
        name: rows[0].name,
        address: rows[0].address,
        date_of_birth: studentDoB,
        gender: rows[0].gender,
        major: rows[0].major,
        student_email: rows[0].student_email
      })
    }
  });
});

router.post('/edit', function(req, res, next) {
  req.assert('name', 'Name is required').notEmpty();          
  req.assert('address', 'Address is required').notEmpty();
  req.assert('date_of_birth', 'Date is required').notEmpty();
  req.assert('student_email', 'Email is not Valid').isEmail();
  req.assert('major', 'Major is required').notEmpty();
  var errors = req.validationErrors();
  if (errors) {
    var error_message = '';
    errors.forEach(function (error) {
      error_message += error.msg + '\n'
    })
    alertNode(error_message);
  } else {
    var id = req.body.id;
    var student_id = req.body.student_id;
    var admission_date = moment(req.body.admission_date).format('YYYY-MM-DD');
    var name = req.body.name;
    var address = req.body.address;
    var date_of_birth = moment(req.body.date_of_birth).format('YYYY-MM-DD');
    var gender = req.body.gender;
    var major = req.body.major;
    var student_email = req.body.student_email;

    var today = new Date();
    var newtoday = moment(today).format('YYYY-MM-DD');
    if (date_of_birth < newtoday) {
      con.query('UPDATE students SET id = ?, admission_date = ?, name = ?, address = ?, date_of_birth = ?, gender = ?, major = ?, student_email = ? WHERE student_id = ?', [id, admission_date, name, address, date_of_birth, gender, major, student_email, student_id], function (error, results, fields) {
        if (error) return next(error);
        res.redirect('/students');
      });
    } else {
      alertNode("You can't enter date of birth in future!");
    }
  }
});

router.post('/delete/:id', function (req, res, next) {
  con.query('DELETE from students WHERE student_id = ?', [req.params.id], function (error, results, fields) {
    if (error) return next(error);
    res.redirect('/students');
    console.log(results);
  });
});

module.exports = router;
