var EventEmitter = require('./event_analysis')

var ee = new EventEmitter()
ee.once('newListener', function (event, listener) {
  // if (event === 'aEvent') {
  //   // Insert a new listener in front
  //   ee.on('bEvent', () => {
  //     console.log('B Event');
  //   });
  // }
  console.log('user new listener event', event)
})

// ee.on('aEvent', () => {
//   console.log('A Event');
// });
// ee.emit('newListener');