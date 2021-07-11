let obj = {
  fn: undefined,
  num: 1
}

function A() {
  console.log(this.num)
}

let bindFn = A.bind(obj)

obj.fn = bindFn

console.log(obj)
obj.fn()