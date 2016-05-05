var gulp = require('gulp');
var nodemon = require('gulp-nodemon');

gulp.task('default', function () {
	// place code for your default task here

	nodemon({
		script: 'index.js'
		, ext: 'js html'
		, env: {'NODE_ENV': 'development'}
	}).on('restart', function () {
		console.log('restarted!')
	})
});