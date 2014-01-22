var exports = module.exports = {
    uploadDir: __dirname + '/upload'
  , maxSize: 2 * 1024 * 1024 // 2M
  , id: '{%yyyy-MM-dd}/{hash}'
  , checksum: 'sha1'
  , buckets: {
        avatar: {
            allowed: ['jpg', 'jpeg', 'png', 'bmp']
          , image: {
            }
        }
    }
}
