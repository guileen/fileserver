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
  , id: '{hash}{ext}' // allowed {%yymmdd} {hash} {shortid}
  , shortid: false
  , shortidLength: 6
  , allowed: ['jpg', 'jpeg', 'png', 'bmp', 'zip', 'rar', 'txt']
    // image configure
    // jpeg, jpg, bmp -> jpg
    // gif -> gif
    // png -> png
  , usercrop: true
  , autocrop: true
  , minratio: 0 // min w/h 1/2
  , maxratio: 0 // max w/h 2/1
  , fixratio: 0
  , minwidth: 0 // not allowed if quality too small
  , minheight: 0
  , maxwidth: 0 //
  , maxheight: 0
  , quality: {
        "default": 100
      , mid: 80
      , low: 50
    }
  , copies: [] // e.g.  ['1024x0-low', '1024x768-mid', '1600x960']
}

// init config from defaultConfig
for (var key in defaultConfig) {
    // don't use config[key] = config[key] || defaultConfig[key];
    // config.foo = false; defaultConfig.foo = true; result should be false;
    if(config[key] === undefined) {
        config[key] = defaultConfig[key];
    }
}

for(var bucket in config.buckets) {
    var conf = config.buckets[bucket];
    // init bucket config
    for (var key in config) {
        if(conf[key] === undefined) 
            conf[key] = config[key];
    }
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
          , ext: _path.extname(file.name)
          , size: file.size
          , date: file.lastModifiedDate
          , shortid: conf.shortid && util.genShortId(conf.shortidLength)
    });
    console.log(conf);
    // TODO shortid
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
