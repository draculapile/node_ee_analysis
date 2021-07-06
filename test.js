var EventEmitter = require('./event_analysis')

var ee = new EventEmitter()
ee.on('taowa', function outter() {
  console.log('outter')
  ee.on('taowa', outter)
})

ee.emit('taowa')