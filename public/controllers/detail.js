angular.module('MyApp')
    .controller('DetailCtrl', ['$scope', '$rootScope', '$routeParams', 'Show', 'Subscription',
        function($scope, $rootScope, $routeParams, Show, Subscription) {
            Show.get({ _id: $routeParams.id }, function(show) {
                // .get()返回的data，定义为show
                // 用$scope.show存放，使至在detail.html里起作用
                $scope.show = show;

                $scope.isSubscribed = function() {
                    return $scope.show.subscribers.indexOf($rootScope.currentUser._id) !== -1;
                };

                $scope.subscribe = function() {
                    Subscription.subscribe(show).success(function() {
                        $scope.show.subscribers.push($rootScope.currentUser._id);
                    });
                };

                $scope.unsubscribe = function() {
                    Subscription.unsubscribe(show).success(function() {
                        var index = $scope.show.subscribers.indexOf($rootScope.currentUser._id);
                        $scope.show.subscribers.splice(index, 1);
                    });
                };

                $scope.nextEpisode = show.episodes.filter(function(episode) {
                    // show.episodes返回一个数组
                    // 有关所有剧集的数组
                    // 当return为true，episode才会被加入新数组
                    // 取得数组第一个元素，这里只关心最新的episode
                    return new Date(episode.firstAired) > new Date();
                })[0];
            });
        }
    ]);
