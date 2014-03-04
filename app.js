var os = require('os');
var fs = require('fs');
var gm = require('gm');
var _path = require('path');
var mkdirp = require('mkdirp');
var sizeOf = require('image-size');
var util = require('./util');
var qweb = require('qweb');
var mime = require('mime');
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
  , minratio: 0 // min w/h 1/2
  , maxratio: 0 // max w/h 2/1
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

function getBucketFile(bucket, id) {
    var conf = config.buckets[bucket];
    // -- to /
    return _path.join(conf.uploadDir, bucket, id.replace(/--/g, '/'));
}

function getBucketTagFile(bucket, tag, id) {
    var conf = config.buckets[bucket];
    return _path.join(conf.uploadDir, bucket, tag, id.replace(/--/g, '/'));
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

function handleImage(path, width, height, quality, crop_rect, callback) {
    cclog.info(handleImage, path, width, height);
    if(!callback) {
        if(typeof crop_rect == 'function') {
            callback = crop_rect;
            crop_rect = null;
        } else if(typeof quality == 'function') {
            callback = quality;
            quality = null;
        } else if(typeof height == 'function') {
            callback = height;
            height = null;
        }
    }
    var _w = parseInt(width);
    var _h = parseInt(height);
    var quality = parseInt(quality);
    sizeOf(path, function(err, dim) {
            if(err) throw err;
            var chain = gm(path);
            w = dim.width;
            h = dim.height;
            ratio = w / h;
            if(quality) {
                chain.quality(quality);
            }
            // do crop first
            if(crop_rect) {
                chain.crop(crop_rect.w, crop_rect.h, crop_rect.x, crop_rect.y)
            }
            // resize and auto crop
            if(_w && _h && !crop_rect) {
                var _ratio = _w / _h;
                if(_ratio < ratio) {
                    chain.resize(null, _h);
                    chain.crop(_w, _h, (ratio * _h - _w) / 2, 0);
                } else if (_ratio > ratio) {
                    chain.resize(_w);
                    chain.crop(_w, _h, 0, (_w / ratio - _h) / 2);
                } else {
                    chain.resize(_w, _h);
                }
            }
            // resize
            else if(_w && w > _w) {
                w = _w;
                h = w / ratio;
                chain.resize(w, h);
            }
            else if (_h && h > _h) {
                h = _h;
                w = h * ratio;
                chain.resize(w, h);
            }
            callback(chain);
    });
}

function getWidthHeightOfSize(size) {
    var m = size.match(/(\d*)x(\d*)(?:-(.+))?/);
    if(!m) throw new Error('bad tag ' + tag);
    return [parseInt(m[1]), parseInt(m[2]), m[3]]
}

function processFile(bucket, conf, file, id) {
    // process file
    if(file.type.indexOf('image') >= 0) {
        processImage(bucket, conf, file, id);
    } else {
        moveFile(file.path, getBucketFile(bucket, id));
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
        var m = getWidthHeightOfSize(tag);
        var _w = m[0]
          , _h = m[1]
          , quality = m[2] ? conf.quality[m[2]] : 100
          ;
        handleImage(rawImage, _w, _h, quality, function(chain) {
                writeChain(chain, getBucketTagFile(bucket, tag, id), cclog.intercept('handleTag ' + tag));
        })
    }

    var baseRect, rawImage, w, h, ratio;
    sizeOf(file.path, function(err, dim) {
            var chain = gm(file.path);
            w = dim.width;
            h = dim.height;
            if(conf.usercrop) {
                // TODO set crop rect
                // w = croped width;
                // h = croped heigh;
            }
            ratio = w / h;
            if(conf.maxwidth && w > conf.maxwidth) {
                w = conf.maxwidth;
                h = w / ratio;
            }
            if(conf.maxheight && h > conf.maxheight) {
                h = conf.maxheight;
                w = h * ratio;
            }
            if(conf.minratio && ratio < conf.minratio) {
                w = h * conf.minratio;
                ratio = conf.minratio;
            }
            if(conf.maxratio && ratio > conf.maxratio) {
                h = w / conf.maxratio;
                ratio = conf.maxratio;
            }

            rawImage = getBucketFile(bucket, id);
            handleImage(file.path, w, h, /* quality, crop_rect, */ function(chain) {
                    if(file.rawext == '.bmp') {
                        chain.setFormat('JPEG');
                    }
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
    })
}

qweb.res.sendStatus = function(statusCode, msg) {
    this.writeHead(statusCode);
    this.end(msg);
}

var server = qweb();
server.post('/:bucket', function(req, res) {
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
                    file.rawext = file.ext;
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
          , expectedLength = parseInt(req.headers['content-length'])
          , contentType = req.headers['content-type']
          , recieved = 0
          , conf = config.buckets[bucket]
          , tmpPath = conf.uploadDir + '/' + Date.now() + '-' + id.replace(/\//g, '')
          ;
        if(!conf) {
            return res.sendStatus(404, '404 no such bucket');
        }
        if(!id) {
            return res.sendStatus(400, 'Require resource id PUT /bucket/id');
        }
        if(expectedLength > conf.maxSize) {
            return res.sendStatus(400, 'File too Large');
        }
        cclog.info('expectedLength', expectedLength);
        req.on('data', function(buffer) {
                cclog.info('on data')
                recieved += buffer.length;
                if(recieved > expectedLength) {
                    req.abort();
                    res.sendStatus(400, 'Body size greate than content-length');
                }
                if(recieved > conf.maxSize) {
                    req.abort();
                    res.sendStatus(400, 'File is too Large')
                }
        })
        req.pipe(fs.createWriteStream(tmpPath));
        cclog.info('fooo');
        // req.resume();
        req.on('end', function() {
                var file = {
                    path : tmpPath
                  , type : contentType
                }
                cclog.info(recieved);
                processFile(bucket, conf, file, id);
                res.end();
        });
}).get('/:bucket/:id/imageinfo', function(req, res) {

}).get('/:bucket/:id/exif', function(req, res) {

}).get('/debug/:bucket', function(req, res) {
        var text = fs.readFileSync(__dirname + '/upload.html', 'utf-8');
        res.end(text.replace(/{bucket}/g, req.params.bucket));
}).get('/:bucket/:id', function(req, res) {
        var bucket = req.params.bucket;
        var id = req.params.id;
        var conf = config.buckets[bucket];
        var size = req.query.size;
        var crop = req.query.crop;
        var left = req.query.left;
        var top = req.query.top;
        var width = req.query.width;
        var height = req.query.height;
        var quality = req.query.quality;
        var format = req.query.format;
        if(size) {
            if(width || height) return res.sendStatus(400, 'Should not set size and width or height together');
            var m = getWidthHeightOfSize(size);
            width = m[0];
            height = m[1];
        }
        var filepath = getBucketFile(bucket, id);

        cclog.info('handle', filepath);
        handleImage(filepath, width, height, quality, /* crop_rect */ function(chain) {
                if(!format) {
                    chain.format(function(err, format) {
                            handle(format);
                    })
                } else handle(format);
                function handle(format) {
                    res.writeHead(200, {
                            'Content-Type': mime.lookup(format || filepath)
                    })
                    chain.stream(format).pipe(res);
                }
        })
}).on('domainError', function(err, req, res) {
        cclog.error(req.method, req.url, err);
        res.sendStatus(500, 'ERR:' + err.message);
});

if(!module.parent) {
    process.env.PATH = process.env.PATH + ':/usr/local/bin';
    var port = process.argv[2] || 7195;
    server.listen(port);
    cclog.info('server listen at', port)
}
