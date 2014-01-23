var exports = module.exports = {
    uploadDir: __dirname + '/upload'
  , maxSize: 2 * 1024 * 1024 // 2M
  , id: '{%yyyy-MM-dd}/{hash}'
  , checksum: 'sha1'
  , buckets: {
        avatar: {
            allowed: ['jpg', 'jpeg', 'png', 'bmp']
          , usercrop: true
          , autocrop: true
          , minratio: 1/2
          , maxratio: 2/1
          , fixratio: 0
          , minwidth: 256
          , minheight: 256
          , maxwidth: 1600
          , maxheight: 1600
          , quality: {
                "default": 100
              , mid: 80
              , low: 50
            }
          , copies: [
                '200x-low'
              , 'x400-mid'
              , '800x600'
            ] // e.g.  ['1024x0-low', '1024x768-mid', '1600x960']
        }
    }
}
