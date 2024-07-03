const PENDGING = "pending";
const FULFILLED = "fulfilled";
const REJECTED = "rejected";

class HuPromise {

  state = PENDGING;
  result = undefined;
  _handles = []

  constructor(callback) {
    const resolve = (result) => {
      if (this.state === PENDGING) {
        this.state = FULFILLED;
        this.result = result;
        this._handles.forEach(({ onFulfilled }) => {
          onFulfilled()
        })
      }
    };

    const reject = (result) => {
      if (this.state === PENDGING) {
        this.state = REJECTED;
        this.result = result;
        this._handles.forEach(({ onRejected }) => {
          onRejected()
        })
      }
    };

    // 异常处理 捕获实例化时传入的函数可能存在的异常
    try {
      callback(resolve, reject);
    } catch (error) {
      reject(error)
    }
  }

  _resolvePromise(res, p, resolve, reject) {
    // 处理循环引用问题
    if (res === p) {
      throw new TypeError('Chaining cycle detected for promise #<Promise>')
    }
    if (res instanceof HuPromise) {
      res.then(result => resolve(result), error => reject(error))
    }
    else {
      resolve(res)
    }
  }

  then(onFulfilled, onRejected) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/then
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (x) => x;
    onRejected = typeof onRejected === "function" ? onRejected : (e) => { throw e };
    const p = new HuPromise((resolve, reject) => {
      const asyncFulfilled = () => {
        queueMicrotask(() => {
          try {
            const res = onFulfilled(this.result)
            this._resolvePromise(res, p, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      }

      const asyncRejected = () => {
        queueMicrotask(() => {
          try {
            const res = onRejected(this.result)
            this._resolvePromise(res, p, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      }
      if (this.state === FULFILLED) {
        asyncFulfilled()
      }
      if (this.state === REJECTED) {
        asyncRejected()
      }
      // 暂存
      if (this.state === PENDGING) {
        this._handles.push({
          onFulfilled: asyncFulfilled,
          onRejected: asyncRejected
        })
      }
    })
    return p
  }

  catch(onRejected) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch
    return this.then(undefined, onRejected)
  }

  finally(onFinally) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally
    return this.then(onFinally, onFinally)
  }

  static resolve(value) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve
    if (value instanceof HuPromise) {
      return value
    }
    // 普通值
    return new HuPromise((resolve, reject) => {
      resolve(value)
    })
  }

  static reject(value) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/reject
    return new HuPromise((undefined, reject) => {
      reject(value)
    })
  }

  static race(iterable) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/race
    return new HuPromise((resolve, reject) => {
      if (!Array.isArray(iterable)) {
        return reject(new TypeError('Argument is not iterable!'))
      }
      iterable.forEach((p) => {
        HuPromise.resolve(p).then(res => resolve(res), error => reject(error))
      })
    })
  }

  static all(iterable) {
    //https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/all
    return new HuPromise((resolve, reject) => {
      if (!Array.isArray(iterable)) {
        return reject('Argument is not iterable!')
      }
      if (iterable.length === 0) {
        resolve(iterable)
      }

      const results = []
      let count = 0
      iterable.forEach((p, index) => {
        HuPromise.resolve(p).then(
          res => {
            results[index] = res;
            count++;
            count === results.length && resolve(results)
          },
          error => {
            return reject(error)
          }
        )
      })
    })
  }

  static allSettled(iterable) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled
    return new HuPromise((resolve, reject) => {
      // 非数组，抛出错误
      if (!Array.isArray(iterable)) {
        return reject(new TypeError('Argument is not iterable!'))
      }
      // 空数组，直接兑现
      iterable.length === 0 && resolve(iterable)

      const results = []
      let count = 0

      iterable.forEach((p, index) => {
        HuPromise.resolve(p).then(
          (res) => {
            results[index] = { status: FULFILLED, value: res }
            count++;
            count === iterable.length && resolve(results)
          },
          (error) => {
            results[index] = { status: REJECTED, reason: error }
            count++;
            count === iterable.length && resolve(results)
          })
      })

    })
  }

  static any(iterable) {
    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/any
    return new HuPromise((resolve, reject) => {
      // 不传入数组，直接报错
      if (!Array.isArray(iterable)) {
        return reject(new TypeError('Argument is not iterable!'))
      }
      // 传入空数组，直接拒绝
      iterable.length === 0 && reject(new AggregateError(iterable, 'All promises were rejected'))

      const rejectReasons = []
      let count = 0
      iterable.forEach((p, index) => {
        HuPromise.resolve(p).then(
          (res) => {
            resolve(res)
          }, (error) => {
            rejectReasons[index] = error
            count++
            count === iterable.length && reject(new AggregateError(rejectReasons, 'All promises were rejected'))
          })
      })

    })
  }
}

module.exports = {
  deferred() {
    const res = {}
    res.promise = new HuPromise((resolve, reject) => {
      res.resolve = resolve
      res.reject = reject
    })
    return res
  }
}