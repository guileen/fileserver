var http = require('http');
var req = http.request({
        hostname: '127.0.0.1'
      , port: 7095
      , path: '/avatar/123456'
      , method: 'put'
      , headers: {
            'content-type': 'image/jpeg'
        }
}, function(res) {
    console.log(res.statusCode);
});

var fs = require('fs');
var buff = fs.readFileSync(__dirname + '/../test.jpg');
req.write(buff);
req.end();
