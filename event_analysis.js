// const inspect = require('util').inspect

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// apply 方法和获取对象属性名称方法，优先从 Reflect 获取
// Reflect.apply() Reflect.ownKeys()
// 参考资料：
// Reflect MDN https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Reflect
// Reflect API 设计目的
// What does the Reflect object do in JavaScript?
// https://stackoverflow.com/questions/25421903/what-does-the-reflect-object-do-in-javascript#:~:text=However%2C%20there%20is%20a%20short%20explanation%20about%20it%27s%20purpose%20in%20ES%20Harmony%3A
// ES6 设计反射 Reflect 的意义是什么？
// https://www.zhihu.com/question/276403215
// 使 JS 这门语言更完备，提供更简单、合理的 API，优化了命名空间
// 将之前一些命令式 API 的操作，如 delete obj.key 改为函数式 Reflect.deleteProperty(obj, name)
var R = typeof Reflect === 'object' ? Reflect : null
var ReflectApply = R && typeof R.apply === 'function'
  ? R.apply
  : function ReflectApply(target, receiver, args) {
    return Function.prototype.apply.call(target, receiver, args);
  }

// Reflect.ownKeys 的值等同于 Object.getOwnPropertyNames(target).concat(Object.getOwnPropertySymbols(target))
// 返回一个数组，包含对象自身的所有键名，不管键名是 Symbol 或字符串，也不管是否可枚举
var ReflectOwnKeys
if (R && typeof R.ownKeys === 'function') {
  ReflectOwnKeys = R.ownKeys
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target)
      .concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys(target) {
    return Object.getOwnPropertyNames(target);
  };
}

// 封装统一的 warn 警告信息
function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}

// Number.isNaN 或者利用 NaN 不等于自身的特点判断是否为 NaN
var NumberIsNaN = Number.isNaN || function NumberIsNaN(value) {
  return value !== value;
}

function EventEmitter() {
  EventEmitter.init.call(this);
}
module.exports = EventEmitter;
module.exports.once = once;

// 向后兼容低版本 node
// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;


// _events: {}
// 保存 ee 实例中所有注册事件 [key] 和所对应的处理函数 [listener]
// [key]: listener / [listener1, listener2, ...]，事件可能注册了一个或多个监听函数

// _eventsCount: Number
// ee 实例中注册的事件个数

// _maxListeners: Number
// 单个事件最多能承载的监听函数个数，默认值为 defaultMaxListeners: 10
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._eventsCount = 0;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

// 检查 listener 是否为函数类型
function checkListener(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}

// 定义 ee 实例上的 defaultMaxListeners 默认值的 get set 方法，可取值，可修改
Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== 'number' || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + '.');
    }
    defaultMaxListeners = arg;
  }
});

EventEmitter.init = function() {

  if (this._events === undefined ||
      this._events === Object.getPrototypeOf(this)._events) {
    this._events = Object.create(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// 定义修改 max listener 的方法
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + '.');
  }
  this._maxListeners = n;
  return this;
};

function _getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

// 获取 max listener 值，优先级：setMaxListeners 配置， defaultMaxListeners 默认值
EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};

// emit 发射器实现，核心思想是依次执行每个 listener
EventEmitter.prototype.emit = function emit(type) {
  console.log('emit called')
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = (type === 'error');

  // 处理 emit('error') 的情况
  // 如果 emit 的 type 参数为 'error'，但是没有为 error 注册监听 listener，就直接抛出 Error 错误
  // throw er 后面的注释是有意为之，会在 Node 运行的控制台输出，增强错误提示，表示有未处理的异常情况
  var events = this._events;
  // 调试时，可以使用 util.inspect() 来查看 object 的信息 // console.log(inspect(events, true))
  if (events !== undefined)
    doError = (doError && events.error === undefined);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      // Note: The comments on the `throw` lines are intentional, they show
      // up in Node's output if this results in an unhandled exception.
      throw er; // Unhandled 'error' event
    }
    // At least give some kind of context to the user
    var err = new Error('Unhandled error.' + (er ? ' (' + er.message + ')' : ''));
    err.context = er;
    throw err; // Unhandled 'error' event
  }

  var handler = events[type];

  // console.log(inspect(events, true), Object.keys(events))

  if (handler === undefined)
    return false;

  /**
   * 判断 events 对象里该事件的 handler 类型，如果为：
   * 1.函数：事件注册了单个侦听器，type: handler，直接执行
   * 2.数组：事件注册了多个侦听器，type: [handler, handler, ...]，使用 for 循环逐个调用执行
   *
   * 注意很重要的一点：执行的并不是原数组，而是 arrayClone 拷贝出来的一份，是为了防止在一个事件监听器中监听同一个事件，从而导致死循环的出现
   * 例如：
   * ee.on('foo', function bar() { ee.on('foo', bar) })
   * emit('foo')
   * 在 emit 'foo' 事件的时候，处理器 'bar' 函数又给 'foo' 事件添加了处理程序，正在迭代的 handler 数组遭到了修改
   * 所以要执行拷贝出来的数组，保证第一次触发 'foo' 事件时不会调用第二个处理程序而进入死循环
   */
  if (typeof handler === 'function') {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners[i], this, args);
  }

  return true;
};

/**
 *
 * @param {*} target 上下文，总是传入 this，即：EventEmitter 实例
 * @param {String} type 事件类型名称
 * @param {Function} listener 事件监听器
 * @param {Boolean} prepend prependListener 时传入 true，将监听器函数放入监听器数组头部
 * @returns this
 */
function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  checkListener(listener);

  events = target._events;
  if (events === undefined) {
    // 如果是第一次为 ee 实例添加事件和监听器
    // Object.create 方法创建一个纯净的对象
    events = target._events = Object.create(null);
    target._eventsCount = 0;
  } else {
    // 在注册一个事件的监听器时，如果 this.events 上有 'newListener'，即注册过 'newListener' 事件的监听器
    // 则：ee 实例会直接 emit 'newListener'，即执行 'newListener' 上的监听器函数
    // 设计思维就是，用户使用 'newListener' API 就是为了在注册一个 new listener 时，处理一些逻辑
    // Node.js 源码内部，确实是这么用的

    // 而且，当出现以下情景时：
    // ee.once('newListener', (event, listener) => {
    //   if (event === 'eventA') {
    //     ee.on('eventA', () => console.log('this callback will be called first'))
    //   }
    // })
    // ee.on('eventA', () => console.log('event A'))
    // 即：在 'newListener' 监听器中，如果为一个事件 A 注册了监听器函数，那么它会被插入到在 on 方法中为 A 注册的
    // eventA 监听器之前执行


    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener !== undefined) {
      // target === this
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // 重新在 this 上拿到 _events，因为 'newListener' 的监听器函数可能会修改 events 对象
      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  // 如果 events 上没有该事件的监听器，则添加到 events 对象
  // 否则：判断 events[type] 是函数（之前只为该事件注册了一个监听器）还是数组（之前已经为该事件注册了多个监听器）
  //      并根据 prepend 参数，决定将本次注册的监听器函数插入到监听器数组头部或者尾部
  //      本次注册完成后，这个事件的 listener 一定是一个数组形式
  if (existing === undefined) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
        prepend ? [listener, existing] : [existing, listener];
      // If we've already got an array, just append.
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }

    // 判断该事件注册的监听器是否超过 max listener阈值，超过的话抛出警告信息
    // Check for listener leak
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      // No error code for this since it is a Warning
      // eslint-disable-next-line no-restricted-syntax
      var w = new Error('Possible EventEmitter memory leak detected. ' +
                          existing.length + ' ' + String(type) + ' listeners ' +
                          'added. Use emitter.setMaxListeners() to ' +
                          'increase limit');
      w.name = 'MaxListenersExceededWarning';
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }

  return target;
}

// addListener、on、prependListener 三个方法，均执行 _addListener 逻辑
// prependListener 方法的 prepend 参数 为 true
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

// 单次监听器 once，最多触发一次，触发后，执行的是 _onceWrap 包裹的 listener

// _onceWrap 内部定义了一个对象 state，除了 target(指向 ee 实例)、type、listener 外，定义了 fired 和 wrapFn
// fired: 标识是否调用，初始值为 false
// wrapFn: onceWrapper 函数绑定了 state 对象后的拷贝
// _onceWrap 的返回值是绑定了 state 的 onceWrapper 函数的返回值

// onceWrapper 函数内部的 this === state
// 判断 fired 为 false，然后在用户定义的 listener 执行前
// 用 ee 实例的 removeListener 方法将 listenr 移除，然后将 fired 置为 true
// 执行 listener，返回原 listener 的返回值
function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  // wrapped 的 'this' 绑定到 state
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

// 将单次触发的 listenr 执行提前
EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      checkListener(listener);
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// 移除指定事件的一个监听器，同样需要判断该事件注册了单个还是多个监听器
// 对于多个监听器 listener 数组的操作，调用了 spliceOne 方法从数组中删除单项
// （在数据量大的情况下，spiceOne 方法确实比 Array.prototype.splice() 方法略快）
// 同样的，如果说 event 上有为 'removeListener' 注册监听器，
// 那么在执行本次 remove 之后（与 _addListener 内部对 'newListener' 的处理时机相反），ee 实例也会触发 'removeListener' 事件执行回调
// 定义 originalListener 也是为了保证能拿到原 listener

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      checkListener(listener);

      events = this._events;
      if (events === undefined)
        return this;

      list = events[type];
      if (list === undefined)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = Object.create(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        // position 方便判断当前对数组进行什么操作
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else {
          spliceOne(list, position);
        }

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener !== undefined)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.off = EventEmitter.prototype.removeListener;

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (events === undefined)
        return this;

      // not listening for removeListener, no need to emit
      if (events.removeListener === undefined) {
        if (arguments.length === 0) {
          this._events = Object.create(null);
          this._eventsCount = 0;
        } else if (events[type] !== undefined) {
          if (--this._eventsCount === 0)
            this._events = Object.create(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = Object.create(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners !== undefined) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

// 返回指定事件监听器数组的副本
// 'rawListener' 调用时会传入 unwrap 为 false
// 会返回被包装过的监听器，如 _onceWrap() 处理过的 listener
function _listeners(target, type, unwrap) {
  var events = target._events;

  if (events === undefined)
    return [];

  var evlistener = events[type];
  if (evlistener === undefined)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ?
    unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events !== undefined) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener !== undefined) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};

// 三个工具函数
function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

// 对外暴露的 once 方法，在 web 平台的 EventTarget DOM 接口，也可使用
// 返回一个 Promise，当 ee 实例 emit 给定 name 事件时，将所有给定事件的所有参数 resolve；
// 如果 ee 实例 emit 'error' 事件则 reject(err)，可以被 try catch 捕获

// 注意，如果 once 方法传入 name 为 error 时，表示 once 在等待 error 事件本身
// 那么 ee 实例 emit 'error' 时，once 方法将会当作普通事件一样处理，即走到 resolve() 流程，而不会再 reject
function once(emitter, name) {
  return new Promise(function (resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }

    function resolver() {
      if (typeof emitter.removeListener === 'function') {
        emitter.removeListener('error', errorListener);
      }
      resolve([].slice.call(arguments));
    };

    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    // 如果 name !== 'error'，传入普通事件，需要手动添加 error 情况的处理
    if (name !== 'error') {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}

function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === 'function') {
    eventTargetAgnosticAddListener(emitter, 'error', handler, flags);
  }
}

function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === 'function') {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === 'function') {
    // 根据是否有 'addEventListener' 方法，判断是否为 web EventEmitter 接口，此时不监听 error 事件

    // EventTarget does not have `error` event semantics like Node
    // EventEmitters, we do not listen for `error` events here.
    emitter.addEventListener(name, function wrapListener(arg) {
      // IE does not have builtin `{ once: true }` support so we
      // have to do it manually.
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}

// ************ end ************
// Node.js 的 EventEmitter 设计还是很完备的，而且很考虑细节上的性能优化，比如 for 循环内部的会使用 ++i
// 来代替常见的 i++ 操作（i++ 是在使用当前值之后再 +1，会占用一个临时变量空间，++i 则相对节省内存）