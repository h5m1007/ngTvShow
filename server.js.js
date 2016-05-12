
/**
 * Module dependencies.
 */

var express = require('express')
  , path = require('path')
  , logger = require('morgan') // 用来输出用户请求日志
  , bodyParser = require('body-parser') // 请求内容解析中间件
  , mongoose = require('mongoose')
  // mongoose可把MongoDB(文档型数据库)的文档转化为js对象
  , bcrypt = require('bcryptjs') // 加密(哈希和盐化)
  , async = require('async')
  , request = require('request')
  , xml2js = require('xml2js') // xml格式转化javascript
  , _ = require('lodash')
  , cookieParser = require('cookie-parser')
  , session = require('express-session')
  , passport = require('passport') // 以某种策略方式验证请求
  , LocalStrategy = require('passport-local').Strategy // 应用本地验证策略
  , agenda = require('agenda')({ db: { address: 'localhost:27017/test' } })
  // agenda为nodejs任务调度
  , sugar = require('sugar') // 对javascript拓展
  , nodemailer = require('nodemailer'); // nodejs邮件发送组件;

var showSchema = new mongoose.Schema({
	// 存储数据库模型架构
	_id: Number,
	name: String,
	airsDayOfWeek: String,
	airsTime: String,
	firstAired: Date,
	genre: [String],
	network: String,
	overview: String,
	rating: Number,
	status: String,
	poster: String,
	subscribers: [{
		type: mongoose.Schema.Types.ObjectId,
		ref: 'User'
	}],
	episodes: [{
		season: Number,
		episodeNumber: Number,
		episodeName: String,
		firstAired: Date,
		overview: String
	}]
});

var userSchema = new mongoose.Schema({
	email: { type: String, unique: true },
	password: String
});

userSchema.pre('save', function(next){
	// 中间件 需等待中间件执行完后在执行其余操作
	var user = this;
	if(!user.isModified('password')) return next();
	// 当密码没被修改时执行下一步操作next()，反之执行下一步操作
	bcrypt.genSalt(10, function(err, salt){
		if(err) return next(err);
		bcrypt.hash(user.password, salt, function(err, hash){
			if(err) return next(err);
			user.password = hash;
			next();
		});
	});
});

userSchema.methods.comparePassword = function(candidatePassword, cb){
	bcrypt.compare(candidatePassword, this.password, function(err, isMatch){
		if(err) return cb(err);
		cb(null, isMatch);
	});
};

var User = mongoose.model('User', userSchema);
var Show = mongoose.model('Show', showSchema);

mongoose.connect('localhost');

var app = express();

// 环境变量
app.set('port', process.env.PORT || 3000);

// 定义日志和输出级别
app.use(logger('dev'));

// 加载各中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());

app.use(function(err, req, res, next){
	console.error(err.stack);
	res.send(500, {
		message: err.message
	});
});

app.use(function(req, res, next){
	// 一旦user通过验证 会生成新cookie
	if(req.user){
		res.cookie('user', JSON.stringify(req.user));
	}
	next();
});

// 定义静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

function ensureAuthenticated(req, res, next){
	if(req.isAuthenticated()) next();
	else res.send(401);
}

passport.use(new LocalStrategy({ usernameField: 'email' }, function(email, password, done){
	// 自定义认证字段 对应页面上input且name为email
	User.findOne({ email: email }, function(err, user){
		// .findOne(查询条件, callback) --> mongoDB 打开数据库查询一条数据
		// 从数据库User中，以{email: email}为查询条件
		// passport自身不处理验证
		// 所有验证由callback自行设置 --> 验证回调
		// 验证回调返回验证结果，由done()完成
		if(err) return done(err); // <-- 系统级异常如数据库查询出错
		if(!user) return done(null, false); // <-- 验证不通过的返回
		user.comparePassword(password, function(err, isMatch){
			if(err) return done(err);
			if(isMatch) return done(null, user); // <-- 验证通过的返回
			return done(null, false);
		});
	});
}));

passport.serializeUser(function(user, done){
	// 把user.id序列化至session即sessionID
	// 作为凭证存储至cookie
	done(null, user.id);
});

passport.deserializeUser(function(id, done){
	// 从session反序列化 id为sessionID
	User.findById(id, function(err, user){
		// 在User数据库查询id 并存储至req.user
		done(err, user);
	});
});


app.get('/api/shows', function(req, res, next){
	var query = Show.find();
	if(req.query.genre){
		query.where({ genre: req.query.genre });
	}else if(req.query.alphabet){
		query.where({ name: new RegExp('^' + '[' + req.query.alphabet + ']', 'i') });
	}else{
		query.limit(12);
	}
	query.exec(function(err, shows){
		if(err) return next(err);
		res.send(shows);
	});
});

app.get('/api/shows/:id', function(req, res, next){
	Show.findById(req.params.id, function(err, show){
		if(err) return next(err);
		res.send(show);
	});
});

app.get('*', function(req, res){
	res.redirect('/#' + req.originalUrl);
});

app.post('/api/shows', function(req, res, next){
	console.log("for test~");
	var apiKey = 'AAEAD85F45D951E9'; // apply the key from the TVDB
	var parser = xml2js.Parser({
		// xml 转 javascript
		explicitArray: false,
		normalizeTags: true
	});
	var seriesName = req.body.showName
		.toLowerCase()
		.replace(/ /g, '_')
		.replace(/[^\w-] + /g, '');
	async.waterfall([
		// 多个函数依次执行，且前一个输出为后一个输入
		// 某个函数出错，后面函数将不会被执行
		function(callback){
			// 获得由showId检索得到的showName
			request.get('http://thetvdb.com/api/GetSeries.php?seriesname=' + seriesName, function(error, response, body){
				if(error) return next(error);
				parser.parseString(body, function(err, result){
					if(!result.data.series){
						return res.send(404, {
							message: req.body.showName + 'was not found.'
						});
					}
					var seriesId = result.data.series.seriesid || result.data.series[0].seriesid;
					callback(err, seriesId);
				});
			});
		},
		function(seriesId, callback){
			// 获得由上一个fn返回的showId检索得到的showInfo
			request.get('http://thetvdb.com/api/' + apiKey + '/series/' + seriesId + '/all/en.xml', function(error, response, body){
				if(error) return next(error);
				parser.parseString(body, function(err, result){
					var series = result.data.series;
					var episodes= result.data.episode;
					var show = new Show({
						_id: series.id,
						name: series.seriesname,
						airsDayOfWeek: series.airs_dayofweek,
						airsTime: series.airs_time,
						firstAired: series.firstaired,
						genre: series.genre.split('|').filter(Boolean),
						network: series.network,
						overview: series.overview,
						rating: series.ratingcount,
						runtime: series.runtime,
						status: series.status,
						poster: series.poster,
						episodes: []
					});
					_.each(episodes, function(episode){
						show.episodes.push({
							season: episode.seasonnumber,
							episodeNumber: episode.episodenumber,
							episodeName: episode.episodename,
							firstAired: episode.firstaired,
							overview: episode.overview
						});
					});
					callback(err, show);
				});
			});
		},
		function(show, callback){
			// 转换poster img为base64
			var url = 'http://thetvdb.com/banners/' + show.poster;
			request({ url: url, encoding: null }, function(error, response, body){
				show.poster = 'data:' + response.headers['content-type'] + ';base64,' + body.toString('base64');
				callback(error, show);
			});
		}
	], function(err, show){
		if(err) return next(err);
		show.save(function(err){
			if(err){
				if(err.code == 11000){
					return res.send(409, { message: show.name + ' already exists. ' });
				}
				return next(err);
			}
			res.send(200);
		});
	});
});

app.post('/api/subscribe', ensureAuthenticated, function(req, res, next){
	// 订阅
	Show.findById(req.body.showId, function(err, show){
		if(err) return nex(err);
		show.subscribers.push(req.user.id);
		show.save(function(err){
			if(err) return next(err);
			res.send(200);
		});
	});
});

app.post('/api/unsubscribe', ensureAuthenticated, function(req, res, next){
	Show.findById(req.body.showId, function(err, show){
		if(err) return next(err);
		var index = show.subscribers.indexOf(req.user.id);
		show.subscribers.splice(index, 1);
		show.save(function(err){
			if(err) return next(err);
			res.send(200);
		});
	});
});

app.post('/api/login', passport.authenticate('local'), function(req, res){
	res.cookie('user', JSON.stringify(req.user));
	res.send(req.user);
});

app.post('/api/signup', function(req, res, next){
	var user = new User({
		email: req.body.email,
		password: req.body.password
	});
	user.save(function(err){
		if(err) return next(err);
		res.send(200);
	});
});

app.get('/api/logout', function(req, res, next){
	req.logout();
	res.send(200);
});

agenda.define('send email alert', function(job, done){
	// 创建任务
	Show.findOne({ name: job.attrs.data }).populate('subscribers').exec(function(err, show){
		var emails = show.subscribers.map(function(user){
			return user.email;
		});

		var upcomingEpisode = show.episodes.filter(function(episode){
			return new Date(episode.firstAired) > new Date();
		})[0];

		var smtpTransport = nodemailer.createTransport('SMTP', {
			service: 'SendGrid',
			auth: { user: 'hslogin', pass: 'hspassword00' }
		});

		var mailOptions = {
			from: 'Fred Foo ✔ <foo@blurdybloop.com>',
			to: emails.join(','),
			subject: show.name + ' is starting soon!',
			text: show.name + ' starts in less than 2 hours on ' +
				show.network + '.\n\n' + 'Episode ' + upcomingEpisode.episodeNumber +
				' overview\n\n' + upcomingEpisode.overview
		};

		smtpTransport.sendMail(mailOptions, function(error, response){
			console.log('Message sent: ' + response.message);
			smtpTransport.close();
			done();
		});
	});
});

agenda.start();

agenda.on('start', function(job){
	console.log("Job %s starting", job.attrs.name);
});

agenda.on('complete', function(job){
	console.log("Job %s finished", job.attrs.name);
});

// 启动及端口
app.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
