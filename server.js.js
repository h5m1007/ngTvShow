
/**
 * Module dependencies.
 */

var express = require('express')
  , path = require('path')
  , logger = require('morgan') // 用来输出用户请求日志
  , bodyParser = require('body-parser') // 请求内容解析中间件
  , mongoose = require('mongoose')
  , bcrypt = require('bcryptjs')
  , async = require('async')
  , xml2js = require('xml2js')
  , _ = require('lodash');

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

// mongoose.connect('localhost');

var app = express();

// 环境变量
app.set('port', process.env.PORT || 3000);

// 定义日志和输出级别
app.use(logger('dev'));

// 定义数据解析器
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

app.use(function(err, req, res, next){
	console.error(err.stack);
	res.send(500, {
		message: err.message
	});
});

// 定义静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

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
	var apiKey = '9EF1D1E7D28FDA0B'; // apply the key from the TVDB
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

// 启动及端口
app.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
