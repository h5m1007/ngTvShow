// 导入工具包 require('node_modules里对应模块')
var gulp = require('gulp');
var sass = require('gulp-sass');
var plumber = require('gulp-plumber');

gulp.task('sass', function(){
	// 定义一个sass任务(自定义任务名称)
	gulp.src('public/stylesheets/style.scss') // 该任务针对的文件
		.pipe(plumber()) // 该任务调用的模块
		.pipe(sass())
		.pipe(gulp.dest('public/stylesheets'));
		// 将会在pubilc/stylesheets下生成style.scss
});

gulp.task('watch', function(){
	gulp.watch('public/stylesheets/*.scss', ['sass']);
});

gulp.task('default', ['sass', 'watch']);