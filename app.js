var os = require('os');
var fs = require('fs');
var _path = require('path');
var mkdirp = require('mkdirp');
var util = require('./util');
var qweb = require('qweb');
var cclog = require('cclog');
var formidable = require('formidable');
var config = require('./config');
config.buckets = config.buckets || {};
var defaultConfig = {
    uploadDir: __dirname + '/upload'
  , maxSize: 10 * 1024 * 1024
  , id: '{hash}' // allowed {%yymmdd} {hash}
  , allowed: ['jpg', 'jpeg', 'png', 'bmp', 'zip', 'rar', 'txt']
  , image: {
        // jpeg, jpg, bmp -> jpg
        // gif -> gif
        // png -> png
        usercrop: true
      , autocrop: true
      , crop: []
    }
}

// init bucket config
for(var bucket in config.buckets) {
    var conf = config.buckets[bucket];
    conf.id = conf.id || config.id || defaultConfig.id;
    conf.maxSize = conf.maxSize || config.maxSize || defaultConfig.maxSize;
    conf.checksum = conf.checksum || config.checksum || defaultConfig.checksum;
    conf.uploadDir = conf.uploadDir || config.uploadDir || defaultConfig.uploadDir;
    mkdirp.sync(conf.uploadDir + '/' + bucket);
    var allowed = conf.allowed || config.allowed || defaultConfig.allowed;
    if(Array.isArray(allowed)) {
        conf.allowed = new RegExp('\\.(' + allowed.join('|') + ')$', ['i']);
    }
    console.log(conf)
}

function handleFile(file, conf) {
    if(file.size == 0) return fs.unlink(file.name);
    var id = util.formatId(conf.id, {
            hash: file.hash
          , size: file.size
          , date: file.lastModifiedDate
    });
    var newPath = _path.join(conf.uploadDir, bucket, id);
    fs.rename(file.path, newPath, function(err){
            if(err) {
                if(err.code == 'ENOENT') {
                    mkdirp(_path.dirname(newPath), function made(er) {
                            if(er) throw er;
                            fs.rename(file.path, newPath, cclog.ifError);
                    });
                } else {
                    cclog.error('error to store file', err);
                }
            }
    })
}

qweb.res.sendStatus = function(statusCode, msg) {
    this.writeHead(statusCode);
    this.end(msg);
}

var server = qweb({
        'post:/upload/:bucket': function(req, res) {
            var bucket = req.params.bucket;
            var bucketConf = config.buckets[bucket];
            if(!bucketConf) {
                return res.sendStatus(404, '404 no such bucket');
            }
            var form = new formidable.IncomingForm();
            form.maxFieldSize = bucketConf.maxSize;
            form.hash = bucketConf.checksum;
            form.uploadDir = bucketConf.uploadDir;
            var allowed = bucketConf.allowed;
            console.log(allowed);
            form.on('fileBegin', function(name, file) {
                    if(!allowed.test(file.name)) 
                        return res.sendStatus('406', '406 File Type Not Acceptable.');
                    console.log('begin file', name, file);
            })
            form.parse(req, function(err, fields, files) {
                    if(err) console.log(err.stack);
                    console.log('all done', util.inspect(files));
                    for(var name in files) {
                        handleFile(files[name], bucketConf);
                    }
                    res.end(util.inspect([fields, files]))
            });
        }
      , 'post:/upload/:bucket/:id': function(req, res) {

        }
      , '/img/:bucket/:id' : function(req, res){

        }
      , '/debug/:bucket' : function(req, res){
            var text = fs.readFileSync(__dirname + '/upload.html', 'utf-8');
            res.end(text.replace(/{bucket}/g, req.params.bucket));
        }
}).on('domainError', function(err, req, res) {
        cclog.error(req.method, req.url, err);
        res.sendStatus(500, 'ERR:' + err.message);
});

if(!module.parent) {
    var port = process.argv[2] || 4000;
    server.listen(port);
    console.log('server listen at', port)
}
