let delay = require('nanodelay')

let ServerNode = require('../server-node')
let ClientNode = require('../client-node')
let LoguxError = require('../logux-error')
let TestTime = require('../test-time')
let TestPair = require('../test-pair')
let BaseNode = require('../base-node')

let PROTOCOL = BaseNode.prototype.localProtocol

let test

function createTest () {
  let time = new TestTime()
  let pair = new TestPair()

  pair.leftNode = new ClientNode('client', time.nextLog(), pair.left)
  pair.rightNode = new ServerNode('server', time.nextLog(), pair.right)

  let current = 0
  pair.leftNode.now = () => {
    current += 1
    return current
  }
  pair.rightNode.now = pair.leftNode.now

  pair.leftNode.catch(() => true)
  pair.rightNode.catch(() => true)

  return pair
}

afterEach(() => {
  if (test) {
    test.leftNode.destroy()
    test.rightNode.destroy()
    test = undefined
  }
})

it('sends protocol version and name in connect message', async () => {
  test = createTest()
  await test.left.connect()
  await test.wait()
  expect(test.leftSent).toEqual([
    ['connect', PROTOCOL, 'client', 0]
  ])
})

it('answers with protocol version and name in connected message', async () => {
  test = createTest()
  await test.left.connect()
  await test.wait('left')
  expect(test.rightSent).toEqual([
    ['connected', PROTOCOL, 'server', [2, 3]]
  ])
})

it('checks client protocol version', async () => {
  test = createTest()
  test.leftNode.localProtocol = 1
  test.rightNode.minProtocol = 2

  await test.left.connect()
  await test.wait('left')
  expect(test.rightSent).toEqual([
    ['error', 'wrong-protocol', { supported: 2, used: 1 }]
  ])
  expect(test.rightNode.connected).toBeFalsy()
})

it('checks server protocol version', async () => {
  test = createTest()
  test.leftNode.minProtocol = 2
  test.rightNode.localProtocol = 1

  await test.left.connect()
  await test.wait('left')
  await test.wait('right')
  expect(test.leftSent).toEqual([
    ['connect', PROTOCOL, 'client', 0],
    ['error', 'wrong-protocol', { supported: 2, used: 1 }]
  ])
  expect(test.leftSent.connected).toBeFalsy()
})

it('checks types in connect message', async () => {
  let wrongs = [
    ['connect', []],
    ['connect', PROTOCOL, 'client', 0, 'abc'],
    ['connected', []],
    ['connected', PROTOCOL, 'client', [0]]
  ]
  await Promise.all(wrongs.map(async msg => {
    let log = TestTime.getLog()
    let pair = new TestPair()
    let node = new ServerNode('server', log, pair.left)
    await pair.left.connect()
    pair.right.send(msg)
    await pair.wait('right')
    expect(node.connected).toBeFalsy()
    expect(pair.leftSent).toEqual([
      ['error', 'wrong-format', JSON.stringify(msg)]
    ])
  }))
})

it('saves other node name', async () => {
  test = createTest()
  test.left.connect()
  await test.leftNode.waitFor('synchronized')
  expect(test.leftNode.remoteNodeId).toEqual('server')
  expect(test.rightNode.remoteNodeId).toEqual('client')
})

it('saves other client protocol', async () => {
  test = createTest()
  test.leftNode.minProtocol = 1
  test.leftNode.localProtocol = 1
  test.rightNode.minProtocol = 1
  test.rightNode.localProtocol = 2

  test.left.connect()
  await test.leftNode.waitFor('synchronized')
  expect(test.leftNode.remoteProtocol).toEqual(2)
  expect(test.rightNode.remoteProtocol).toEqual(1)
})

it('saves other client subprotocol', async () => {
  test = createTest()
  test.leftNode.options.subprotocol = '1.0.0'
  test.rightNode.options.subprotocol = '1.1.0'

  test.left.connect()
  await test.leftNode.waitFor('synchronized')
  expect(test.leftNode.remoteSubprotocol).toEqual('1.1.0')
  expect(test.rightNode.remoteSubprotocol).toEqual('1.0.0')
})

it('has default subprotocol', async () => {
  test = createTest()
  test.left.connect()
  await test.leftNode.waitFor('synchronized')
  expect(test.rightNode.remoteSubprotocol).toEqual('0.0.0')
})

it('checks subprotocol version', async () => {
  test = createTest()
  test.leftNode.options.subprotocol = '1.0.0'
  test.rightNode.on('connect', () => {
    throw new LoguxError('wrong-subprotocol', {
      supported: '2.x',
      used: test.rightNode.remoteSubprotocol
    })
  })

  await test.left.connect()
  await test.wait('left')
  expect(test.rightSent).toEqual([
    ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }]
  ])
  expect(test.rightNode.connected).toBeFalsy()
})

it('checks subprotocol version in client', async () => {
  test = createTest()
  test.rightNode.options.subprotocol = '1.0.0'
  test.leftNode.on('connect', () => {
    throw new LoguxError('wrong-subprotocol', {
      supported: '2.x',
      used: test.leftNode.remoteSubprotocol
    })
  })

  await test.left.connect()
  await test.wait('right')
  await test.wait('right')
  expect(test.leftSent).toEqual([
    ['connect', PROTOCOL, 'client', 0],
    ['error', 'wrong-subprotocol', { supported: '2.x', used: '1.0.0' }]
  ])
  expect(test.leftNode.connected).toBeFalsy()
})

it('throws regular errors during connect event', () => {
  test = createTest()

  let error = new Error('test')
  test.leftNode.on('connect', () => {
    throw error
  })

  expect(() => {
    test.leftNode.connectMessage(PROTOCOL, 'client', 0)
  }).toThrow(error)
})

it('sends credentials in connect', async () => {
  test = createTest()
  test.leftNode.options = { credentials: { a: 1 } }

  test.left.connect()
  await test.leftNode.waitFor('synchronized')
  expect(test.leftSent).toEqual([
    ['connect', PROTOCOL, 'client', 0, { credentials: { a: 1 } }]
  ])
})

it('sends credentials in connected', async () => {
  test = createTest()
  test.rightNode.options = { credentials: 1 }

  test.left.connect()
  await test.leftNode.waitFor('synchronized')
  expect(test.rightSent).toEqual([
    ['connected', PROTOCOL, 'server', [2, 3], { credentials: 1 }]
  ])
})

it('denies access for wrong users', async () => {
  test = createTest()
  test.rightNode.options = {
    async auth () {
      return false
    }
  }

  await test.left.connect()
  await test.wait('left')
  expect(test.rightSent).toEqual([
    ['error', 'wrong-credentials']
  ])
  expect(test.rightNode.connected).toBeFalsy()
})

it('denies access to wrong server', async () => {
  test = createTest()
  test.leftNode.options = {
    async auth () {
      return false
    }
  }

  await test.left.connect()
  await test.wait('right')
  await test.wait('right')
  expect(test.leftSent).toEqual([
    ['connect', PROTOCOL, 'client', 0],
    ['error', 'wrong-credentials']
  ])
  expect(test.leftNode.connected).toBeFalsy()
})

it('allows access for right users', async () => {
  test = createTest()
  test.leftNode.options = { credentials: 'a' }
  test.rightNode.options = {
    async auth (credentials, nodeId) {
      await delay(10)
      return credentials === 'a' && nodeId === 'client'
    }
  }

  await test.left.connect()
  test.leftNode.sendDuilian(0)
  await delay(50)
  expect(test.rightSent[0]).toEqual(['connected', PROTOCOL, 'server', [1, 2]])
})

it('has default timeFix', async () => {
  test = createTest()
  test.left.connect()
  await test.leftNode.waitFor('synchronized')
  expect(test.leftNode.timeFix).toEqual(0)
})

it('calculates time difference', async () => {
  test = createTest()
  let clientTime = [10000, 10000 + 1000 + 100 + 1]
  test.leftNode.now = () => clientTime.shift()
  let serverTime = [0 + 50, 0 + 50 + 1000]
  test.rightNode.now = () => serverTime.shift()

  test.leftNode.options.fixTime = true
  test.left.connect()
  await test.leftNode.waitFor('synchronized')
  expect(test.leftNode.baseTime).toEqual(1050)
  expect(test.rightNode.baseTime).toEqual(1050)
  expect(test.leftNode.timeFix).toEqual(10000)
})

it('uses timeout between connect and connected', async () => {
  let log = TestTime.getLog()
  let pair = new TestPair()
  let client = new ClientNode('client', log, pair.left, { timeout: 100 })

  let error
  client.catch(err => {
    error = err
  })

  await pair.left.connect()
  await delay(101)
  expect(error.name).toEqual('LoguxError')
  expect(error.message).not.toContain('received')
  expect(error.message).toContain('timeout')
})

it('catches authentication errors', async () => {
  test = createTest()
  let errors = []
  test.rightNode.catch(e => {
    errors.push(e)
  })

  let error = new Error()
  test.rightNode.options = {
    async auth () {
      throw error
    }
  }

  await test.left.connect()
  await test.wait('right')
  await delay(1)
  expect(errors).toEqual([error])
  expect(test.rightSent).toEqual([])
  expect(test.rightNode.connected).toBeFalsy()
})

it('sends authentication errors', async () => {
  test = createTest()
  test.rightNode.options = {
    async auth () {
      throw new LoguxError('bruteforce')
    }
  }

  await test.left.connect()
  await test.wait('right')
  await test.wait('left')
  expect(test.rightSent).toEqual([['error', 'bruteforce']])
  expect(test.rightNode.connected).toBeFalsy()
})
