var util = require('../util');
var should = require('should');

util.formatId('{%yyyy-MM-dd}-{hash}', {hash: 'abcde', date: new Date('2014-01-02')}).should.eql('2014-01-02-abcde');
