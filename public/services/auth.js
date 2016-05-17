angular.module('MyApp')
	.factory('Auth', ['$http', '$location', '$rootScope', '$cookieStore', '$alert', '$window'
		function($http, $location, $rootScope, $cookieStore, $alert, $window){
			// auth 身份认证
			$rootScope.currentUser = $cookieStore.get('user');
			$cookieStore.remove('user');

			// var token = $window.localStorage.token;
			// if(token){
			// 	var payload = JSON.parse($window.atob(token.split('.')[1]));
			// 	$rootScope.currentUser = payload.user;
			// }

			// 异步初始化 FB SDK
			$window.fbAsynInit = function(){
				FB.init({
					appId: '624059410963642',
					responseType: 'token',
					version: 'v2.0'
				});
			};

			// 异步加载 FB SDK
			(function(d, s, id){
				var js, fjs = d.getElementsByTagName(s)[0];
				if(d.getElementById(id)){
					return;
				}
				js = d.createElement(s);
				js.id = id;
				js.src = "//connect.facebook.net/en_US/sdk.js";
				fjs.parentNode.insertBefore(js, fjs);
			}(document, 'script', 'facebook-jssdk'));

			// 异步加载Google+ SDK
			(function(){
				var po = document.createElement('script');
				po.type = 'text/javascript';
				po.async = true;
				po.src = 'http://apis.google.com/js/client:plusone.js';
				var s = document.getElementsByTagName('script')[0];
				s.parentNode.insertBefore(po, s);
			})();

			return {
				facebookLogin: function(){
					FB.login(function(response){
						FB.api('/me', function(profile){
							var data = {
								signedRequest: response.authResponse.signedRequest,
								profile: profile
							};
							$http.post('/auth/facebook', data).success(function(token){
								var payload = JSON.parse($window.atob(token.split('.')[1]));
								$window.localStorage.token = token;
								$rootScope.currentUser = payload.user;
								$location.path('/');
								$alert({
									title: 'Cheers!',
									content: 'You have successfully signed-in with Facebook.',
									animation: 'fadeZoomFadeDown',
									type: 'material',
									duration: 3
								});
							});
						});
					}, { scope: 'email, public_profile' });
				},

				googleLogin: function(){
					gapi.auth.authorize({
						client_id: '55262601920-5jhf3qth89okujq6a7lh8bqc9epr8475.apps.googleusercontent.com',
          				scope: 'https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/plus.profile.emails.read',
          				immediate: false
					}, function(token){
						gapi.client.load('plus', 'v1', function(){
							var request = gapi.client.plus.people.get({
								userId: 'me'
							});
							request.execute(function(authData){
								$http.post('/auth/google', { profile: authData }).success(function(token){
									var payload = JSON.parse($window.atob(token.split('.')[1]));
									$window.localStorage.token = token;
									$rootScope.currentUser = payload.user;
									$location.path('/');
									$alert({
										title: 'Cheers!',
										content: 'You have successfully signed-in with Google.',
										animation: 'fadeZoomFadeDown',
										type: 'material',
										duration: 3
									});
								});
							});
						});
					});
				},

				login: function(user){
					// 参数user由login.js调用时传入的对象
					return $http.post('/api/login', user)
						.success(function(data){
							$rootScope.currentUser = data;
							$location.path('/');

							$alert({
								title: 'Cheers!',
								content: 'You have successfully logged in.',
								animation: 'fadeZoomFadeDown',
								type: 'material',
								duration: 3
							});
						})
						.error(function(){
							$alert({
								title: 'Error!',
								content: 'Invalid username or password.',
								animation: 'fadeZoomFadeDown',
								type: 'material',
								duration: 3
							});
						});
				},
				signup: function(user){
					return $http.post('/api/signup', user)
						.success(function(){
							$location.path('/login');

							$alert({
								title: 'Congratulations!',
								content: 'Your account has been created.',
								animation: 'fadeZoomFadeDown',
								type: 'material',
								duration: 3
							});
						})
						.error(function(response){
							$alert({
								title: 'Error!',
								content: response.data,
								animation: 'fadeZoomFadeDown',
								type: 'material',
								duration: 3
							});
						});
				},
				logout: function(){
					return $http.get('/api/logout')
						.success(function(){
							$rootScope.currentUser = null;
							$cookieStore.remove('user');
							$alert({
								content: 'You have been logged out.',
								animation: 'fadeZoomFadeDown',
								type: 'material',
								duration: 3
							});
						});
				}
			};
		}]);