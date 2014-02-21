var exports = module.exports = {
    uploadDir: __dirname + '/upload'
  , maxSize: 2 * 1024 * 1024 // 2M
  , id: '{%yyyy-MM-dd}/{hash}{ext}'
  , checksum: 'sha1'
  , buckets: {
        avatar: {
            allowed: ['jpg', 'jpeg', 'png', 'bmp', 'zip']
          , minratio: 1/2
          , maxratio: 2/1
          , minwidth: 256
          , minheight: 256
          , maxwidth: 800
          , maxheight: 800
          , quality: {
                "default": 100
              , mid: 80
              , low: 50
            }
          , copies: [
                '200x-low'
              , '200x50-low'
              , 'x400-mid'
              , '256x256'
            ] // e.g.  ['1024x0-low', '1024x768-mid', '1600x960']
        }
    }
}
