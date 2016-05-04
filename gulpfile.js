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

gulp.task('QA', function () {
	nodemon({
		script: 'index.js',
		env: {'NODE_ENV': 'QA'}
	}).on('start', function () {
		console.log('nodemon started');
	}).on('crash', function () {
		console.log('script crashed for some reason');
		nodemon.emit('restart');
	});

});


gulp.task('PROD', function () {
	nodemon({
		script: 'index.js',
		env: {'NODE_ENV': 'PROD'}
	}).on('start', function () {
		console.log('nodemon started');
	}).on('crash', function () {
		console.log('script crashed for some reason');
		nodemon.emit('restart');
	});

});