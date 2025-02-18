let isFirstOlder = require('../is-first-older')

it('compares entries by time', () => {
  let a = { id: '2 a 0', time: 2 }
  let b = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('compares entries by real time', () => {
  let a = { id: '1 a 0', time: 2 }
  let b = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('compares entries by other ID parts', () => {
  let a = { id: '1 a 1', time: 1 }
  let b = { id: '1 a 2', time: 1 }
  expect(isFirstOlder(a, b)).toBeTruthy()
  expect(isFirstOlder(b, a)).toBeFalsy()
})

it('compares entries by other ID parts with priority', () => {
  let a = { id: '1 b 1', time: 1 }
  let b = { id: '1 a 2', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('compares entries with same time', () => {
  let a = { id: '2 a 0', time: 1 }
  let b = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('returns false for same entry', () => {
  let a = { id: '1 b 1', time: 1 }
  expect(isFirstOlder(a, a)).toBeFalsy()
})

it('orders entries with different node ID length', () => {
  let a = { id: '1 11 1', time: 1 }
  let b = { id: '1 1 2', time: 1 }
  expect(isFirstOlder(a, b)).toBeFalsy()
  expect(isFirstOlder(b, a)).toBeTruthy()
})

it('works with undefined in one meta', () => {
  let a = { id: '1 a 0', time: 1 }
  expect(isFirstOlder(a, undefined)).toBeFalsy()
  expect(isFirstOlder(undefined, a)).toBeTruthy()
})
