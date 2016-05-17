angular.module('MyApp')
    .directive('uniqueEmail', function($http) {
        // 获取前台的值访问后台，对值进行比对判断是否唯一
        return {
            restrict: 'A',
            require: 'ngModel',
            // require引入已定义好的指令
            // 这里的ngModel为ng自带的指令
            link: function(scope, element, attrs, ngModel) {
                // fn中最后的参数为引入的指令
                // 名称可自定义
                element.bind('blur', function() {
                    if (ngModel.$modelValue) {
                        // 引入指令的调用
                        $http.get('/api/users', {
                            params: { email: ngModel.$modelValue }
                        }).success(function(data) {
                            ngModel.$setValidity('unique', data.available);
                        });
                    }
                });
                element.bind('keyup', function() {
                    ngModel.$setValidity('unique', true);
                });
            }
        };
    });
