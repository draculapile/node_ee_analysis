var EventEmitter = require('./event_analysis')

var ee = new EventEmitter()
ee.on('error', (err) => {
  // console.error('whoops! there was an error')
  console.log(err)
})

ee.emit('error', 'emit error')