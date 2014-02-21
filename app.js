var os = require('os');
var fs = require('fs');
var gm = require('gm');
var _path = require('path');
var mkdirp = require('mkdirp');
var sizeOf = require('image-size');
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
    conf.minratio = conf.fixratio || conf.minratio;
    conf.maxratio = conf.fixratio || conf.maxratio;
    mkdirp.sync(conf.uploadDir + '/' + bucket);
    var allowed = conf.allowed || config.allowed || defaultConfig.allowed;
    if(Array.isArray(allowed)) {
        conf.allowed = new RegExp('\\.(' + allowed.join('|') + ')$', ['i']);
    }
}

function moveFile(oldPath, newPath) {
    fs.rename(oldPath, newPath, function(err){
            if(err) {
                if(err.code == 'ENOENT') {
                    mkdirp(_path.dirname(newPath), function made(er) {
                            if(er) throw er;
                            fs.rename(oldPath, newPath, cclog.ifError);
                    });
                } else {
                    cclog.error('error to store file', err);
                }
            }
    })
}

function writeChain(chain, path, callback) {
    fs.exists(path, function (exists) {
            if(!exists) {
                mkdirp(_path.dirname(path), function made(er) {
                        if(er) return callback(er);
                        chain.write(path, callback);
                })
            } else chain.write(path, callback);
    })
    // chain.write(path, function(err) {
    //         if(err) {
    //             if(err.code == 'ENOENT') {
    //                 return mkdirp(_path.dirname(path), function made(er) {
    //                         if(er) return callback(er);
    //                         chain.write(path, callback);
    //                 })
    //             }
    //         }
    //         callback(err);
    // })
}

function processFile(bucket, conf, file, id) {
    // process file
    if(file.type.indexOf('image') >= 0) {
        processImage(bucket, conf, file, id);
    } else {
        var newPath = _path.join(conf.uploadDir, bucket, 'default', id);
        moveFile(file.path, newPath);
    }
}

function processImage(bucket, conf, file, id) {

    // confTag 1024x0-low
    function getNewFilePath(confTag) {

    }

    function getCropRect() {
        // body...
    }

    // confTag 1024x768-mid
    function handleTag(tag) {
        var m = tag.match(/(\d*)x(\d*)(?:-(.+))?/);
        if(!m) throw new Error('bad tag ' + tag);
        var _w = parseInt(m[1])
          , _h = parseInt(m[2])
          , quality = m[3] ? conf.quality[m[3]] : 100
          ;
        var chain = gm(rawImage);
        if(_w && _h) {
            var _ratio = _w / _h;
            if(_ratio < ratio) {
                chain.resize(null, _h);
                chain.crop(_w, _h, (ratio * _h - _w) / 2, 0);
            } else if (_ratio > ratio) {
                chain.resize(_w);
                chain.crop(_w, _h, 0, (_w / ratio - _h) / 2);
            }
        }
        chain.resize(_w, _h);
        writeChain(chain, _path.join(conf.uploadDir, bucket, tag, id), cclog.intercept('handleTag ' + tag));
    }

    var baseRect, rawImage, w, h, ratio;
    if(conf.usercrop) {
    }
    if(conf.autocrop) {
        // gm(file.path)
    }
    sizeOf(file.path, function(err, dim) {
            var chain = gm(file.path);
            w = dim.width;
            h = dim.height;
            ratio = w / h;
            if(conf.maxwidth && w > conf.maxwidth) {
                w = conf.maxwidth;
                h = w / ratio;
                chain.resize(w, h)
                // } else if(conf.maxheight && h > conf.maxheight) {
                // should not use maxheight. use maxwidth and minratio to control this
            }
            if(conf.usercrop) {
                // TODO: uploader defined crop like avatar dimention cut.
            } else if(conf.autocrop) {
                // ratio 0 to 1, tall-thin to short-fat.
                if(conf.minratio && ratio < conf.minratio) {
                    var _h = w / conf.minratio;
                    chain.crop(w, _h, 0, (h - _h) / 2);
                    h = _h;
                } else if(conf.maxratio && ratio > conf.maxratio) {
                    var _w = h * conf.maxratio;
                    chain.crop(_w, h, (w - _w) / 2, 0);
                    w = _w;
                }
                ratio = w / h;
            }
            rawImage = _path.join(conf.uploadDir, bucket, id);
            writeChain(chain, rawImage, function (err) {
                    if(err) {
                        cclog.error('error to save', rawImage, err);
                    } else {
                        cclog.info('save image to', rawImage);
                    }
                    fs.unlink(file.path);

                    conf.copies.forEach(handleTag);
            });
    })
}

qweb.res.sendStatus = function(statusCode, msg) {
    this.writeHead(statusCode);
    this.end(msg);
}

var server = qweb();
server.post('post:/:bucket', function(req, res) {
        var bucket = req.params.bucket;
        var conf = config.buckets[bucket];
        if(!conf) {
            return res.sendStatus(404, '404 no such bucket');
        }
        var form = new formidable.IncomingForm();
        form.maxFieldSize = conf.maxSize;
        form.hash = conf.checksum;
        form.uploadDir = conf.uploadDir;
        var allowed = conf.allowed;
        form.on('fileBegin', function(name, file) {
                if(!allowed.test(file.name)) 
                    return res.sendStatus('406', '406 File Type Not Acceptable.');
        })
        form.parse(req, function(err, fields, files) {
                if(err) {
                    cclog.error('error to parse form', err);
                    res.end(JSON.stringify({err: 1}));
                }
                var result = {};
                for(var name in files) {
                    var file = files[name];
                    if(file.size == 0) {
                        fs.unlink(file.path);
                        continue;
                    }
                    // generate id
                    file.ext = _path.extname(file.name).toLowerCase();
                    file.shortid = conf.shortid && util.genShortId(conf.shortidLength);
                    file.date = file.lastModifiedDate;
                    if(file.ext == '.bmp') file.ext = '.jpg';
                    var id = util.formatId(conf.id, file);
                    result[name] = id;
                    processFile(bucket, conf, file, id);
                }
                if(fields.redirect) {
                    var redirect = fields.redirect;
                    var qs = [];
                    for(var name in result) {
                        qs.push(encodeURIComponent(name) + '=' + encodeURIComponent(result[name]));
                    }
                    qs = qs.join('&');
                    res.writeHead(302, {
                            'Location': redirect + (redirect.indexOf('?') > 0 ? '&' : '?') + qs
                    })
                    res.end();
                } else {
                    res.end(JSON.stringify(result));
                }
        });
}).put('/:bucket/:id', function(req, res) {
        var bucket = req.params.bucket
          , id = req.params.id
          , conf = config.buckets[bucket]
          , tmpPath = conf.uploadDir + '/' + Date.now() + '-' + id.replace(/\//g, '')
          ;
        if(!conf) {
            return res.sendStatus(404, '404 no such bucket');
        }
        if(!id) {
            return res.sendStatus(400, 'require id');
        }
        req.pipe(fs.createWriteStream(tmpPath));
        // req.resume();
        req.on('end', function() {
                var file = {
                    path : tmpPath
                  , type : req.headers['content-type']
                }
                processFile(bucket, conf, file, id);
                res.end();
        });
}).get('/:bucket/:id', function(req, res) {

}).get('/debug/:bucket', function(req, res) {
        var text = fs.readFileSync(__dirname + '/upload.html', 'utf-8');
        res.end(text.replace(/{bucket}/g, req.params.bucket));
}).on('domainError', function(err, req, res) {
        cclog.error(req.method, req.url, err);
        res.sendStatus(500, 'ERR:' + err.message);
});

if(!module.parent) {
    var port = process.argv[2] || 7095;
    server.listen(port);
    console.log('server listen at', port)
}
