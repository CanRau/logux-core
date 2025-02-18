let ServerNode = require('../server-node')
let LoguxError = require('../logux-error')
let TestTime = require('../test-time')
let TestPair = require('../test-pair')

let node

function createNode () {
  let pair = new TestPair()
  return new ServerNode('server', TestTime.getLog(), pair.left)
}

async function createTest () {
  let test = new TestPair()
  node = new ServerNode('server', TestTime.getLog(), test.left)
  test.leftNode = node
  await test.left.connect()
  return test
}

afterEach(() => {
  node.destroy()
})

it('sends error on wrong message format', async () => {
  let wrongs = [
    1,
    { hi: 1 },
    [],
    [1]
  ]
  await Promise.all(wrongs.map(async msg => {
    let test = await createTest()
    test.right.send(msg)
    await test.wait('right')
    expect(test.left.connected).toBeFalsy()
    expect(test.leftSent).toEqual([
      ['error', 'wrong-format', JSON.stringify(msg)]
    ])
  }))
})

it('sends error on wrong error parameters', async () => {
  let wrongs = [
    ['error'],
    ['error', 1],
    ['error', { }]
  ]
  await Promise.all(wrongs.map(async msg => {
    let test = await createTest()
    test.right.send(msg)
    await test.wait('right')
    expect(test.left.connected).toBeFalsy()
    expect(test.leftSent).toEqual([
      ['error', 'wrong-format', JSON.stringify(msg)]
    ])
  }))
})

it('sends error on unknown message type', async () => {
  let test = await createTest()
  test.right.send(['test'])
  await test.wait('right')
  expect(test.left.connected).toBeFalsy()
  expect(test.leftSent).toEqual([
    ['error', 'unknown-message', 'test']
  ])
})

it('throws a error on error message by default', () => {
  node = createNode()
  expect(() => {
    node.onMessage(['error', 'wrong-format', '1'])
  }).toThrow(new LoguxError('wrong-format', '1', true))
})

it('does not throw errors which are not relevant to code', () => {
  node = createNode()
  node.onMessage(['error', 'timeout', '1'])
  node.onMessage(['error', 'wrong-protocol', { }])
  node.onMessage(['error', 'wrong-subprotocol', { }])
})

it('disables throwing a error on listener', () => {
  node = createNode()

  let errors = []
  node.catch(error => {
    errors.push(error)
  })

  node.onMessage(['error', 'wrong-format', '2'])
  expect(errors).toEqual([new LoguxError('wrong-format', '2', true)])
})

it('emits a event on error sending', async () => {
  let test = await createTest()
  let errors = []
  test.leftNode.on('clientError', err => {
    errors.push(err)
  })

  let error = new LoguxError('test', 'type')
  test.leftNode.sendError(error)
  expect(errors).toEqual([error])
})
