// 导入工具包 require('node_modules里对应模块')
var gulp = require('gulp');
var sass = require('gulp-sass');
var csso = require('gulp-csso');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var plumber = require('gulp-plumber');
var templateCache = require('gulp-angular-templatecache');

gulp.task('sass', function(){
	// 定义一个sass任务(自定义任务名称)
	gulp.src('public/stylesheets/style.scss') // 该任务针对的文件
		.pipe(plumber()) // 该任务调用的模块
		.pipe(sass())
		.pipe(csso()) // 压缩css
		.pipe(gulp.dest('public/stylesheets'));
		// 将会在pubilc/stylesheets下生成style.scss
});

gulp.task('compress', function(){
	gulp.src([
		'public/vendor/angular.js',
		'public/vendor/*.js',
		'public/app.js',
		'public/services/*.js',
		'public/controllers/*.js',
		'public/filters/*.js',
		'public/directives/*.js'
		])
		.pipe(concat('app.min.js')) // 文件合并输出名
		.pipe(uglify()) // 压缩js
		.pipe(gulp.dest('public')); // 文件合并输出存放目录
});

gulp.task('templates', function(){
	gulp.src('public/views/**/*.html')
		.pipe(templateCache({ root: 'views', module: 'MyApp' }))
		.pipe(gulp.dest('public'));
});

gulp.task('watch', function(){
	// .watch(监听对象路径(或由路径组成的数组), [以任务数组为回调])
	gulp.watch('public/stylesheets/*.scss', ['sass']);
	// 监听样式表的变化，一当变化执行sass任务
	gulp.watch('public/views/**/*.html', ['templates']);
	gulp.watch([
		'public/**/*.js',
		'!public/app.min.js',
		'!public/templates.js',
		'!public/vendor'
		],
		['compress']
	);
});

gulp.task('default', ['sass', 'compress', 'templates', 'watch']);