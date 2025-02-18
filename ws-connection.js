var NanoEvents = require('nanoevents')

/**
 * Logux connection for browser WebSocket.
 *
 * @param {string} url WebSocket server URL.
 * @param {function} [WS] WebSocket class if you want change implementation.
 * @param {object} [opts] Extra option for WebSocket constructor.
 *
 * @example
 * import { WsConnection } from 'logux-core'
 *
 * const connection = new WsConnection('wss://logux.example.com/')
 * const node = new ClientNode(nodeId, log, connection, opts)
 *
 * @class
 * @extends Connection
 */
function WsConnection (url, WS, opts) {
  this.connected = false
  this.emitter = new NanoEvents()
  if (WS) {
    this.WS = WS
  } else if (typeof WebSocket !== 'undefined') {
    this.WS = WebSocket
  } else {
    throw new Error('No WebSocket support')
  }
  this.url = url
  this.opts = opts
}

WsConnection.prototype = {
  init: function init (ws) {
    var self = this

    ws.onerror = function (event) {
      self.emitter.emit('error', event.error || new Error('WS Error'))
    }

    ws.onclose = function () {
      if (self.ws) {
        self.connected = false
        self.emitter.emit('disconnect')
      }
    }

    ws.onmessage = function (event) {
      var data
      try {
        data = JSON.parse(event.data)
      } catch (e) {
        self.error(event.data)
        return
      }
      self.emitter.emit('message', data)
    }

    this.ws = ws
  },

  connect: function connect () {
    this.emitter.emit('connecting')
    this.init(new this.WS(this.url, undefined, this.opts))

    var self = this
    return new Promise(function (resolve) {
      self.ws.onopen = function () {
        self.connected = true
        self.emitter.emit('connect')
        resolve()
      }
    })
  },

  disconnect: function disconnect () {
    if (this.ws) {
      this.ws.onclose()
      this.ws.close()
      this.ws = undefined
    }
  },

  on: function on (event, listener) {
    return this.emitter.on(event, listener)
  },

  send: function send (message) {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.emitter.emit('error', new Error('WS was closed'))
    }
  },

  error: function error (message) {
    var err = new Error('Wrong message format')
    err.received = message
    this.emitter.emit('error', err)
  }

}

module.exports = WsConnection
