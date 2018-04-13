const gulp = require('gulp');
const nodemon = require('gulp-nodemon');

gulp.task('nodemon', function() {
  nodemon({
    script: './bin/www'
  }).on('start', function() {
    console.log('Restarting..');
  });
});

gulp.task('default', ['nodemon']);