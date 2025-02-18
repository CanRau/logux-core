var NanoEvents = require('nanoevents')

/**
 * Stores actions with time marks. Log is main idea in Logux.
 * In most end-user tools you will work with log and should know log API.
 *
 * @param {object} opts Options.
 * @param {Store} opts.store Store for log.
 * @param {string|number} opts.nodeId Unique current machine name.
 *
 * @example
 * import Log from 'logux-core/log'
 * const log = new Log({
 *   store: new MemoryStore(),
 *   nodeId: 'client:134'
 * })
 *
 * log.on('add', beeper)
 * log.add({ type: 'beep' })
 *
 * @class
 */
function Log (opts) {
  if (!opts) opts = { }

  if (typeof opts.nodeId === 'undefined') {
    throw new Error('Expected node ID')
  }
  if (typeof opts.store !== 'object') {
    throw new Error('Expected store')
  }
  if (opts.nodeId.indexOf(' ') !== -1) {
    throw new Error('Space is prohibited in node ID')
  }

  /**
   * Unique node ID. It is used in action IDs.
   * @type {string|number}
   */
  this.nodeId = opts.nodeId

  this.lastTime = 0
  this.sequence = 0

  this.store = opts.store

  this.emitter = new NanoEvents()
}

Log.prototype = {

  /**
   * Subscribe for log events. It implements nanoevents API. Supported events:
   *
   * * `preadd`: when somebody try to add action to log.
   *   It fires before ID check. The best place to add reason.
   * * `add`: when new action was added to log.
   * * `clean`: when action was cleaned from store.
   *
   * @param {"preadd"|"add"|"clean"} event The event name.
   * @param {listener} listener The listener function.
   *
   * @return {function} Unbind listener from event.
   *
   * @example
   * const unbind = log.on('add', (action, meta) => {
   *   if (action.type === 'beep') beep()
   * })
   * function disableBeeps () {
   *   unbind()
   * }
   */
  on: function (event, listener) {
    return this.emitter.on(event, listener)
  },

  /**
   * Add action to log.
   *
   * It will set `id`, `time` (if they was missed) and `added` property
   * to `meta` and call all listeners.
   *
   * @param {Action} action The new action.
   * @param {Meta} [meta] Open structure for action metadata.
   * @param {string} [meta.id] Unique action ID.
   * @param {number} [meta.time] Action created time.
   *                             Milliseconds since UNIX epoch.
   * @param {string[]} [meta.reasons] Why action should be kept in log.
   *                                  Action without reasons will be removed.
   * @param {string} [meta.keepLast] Set code as reason and remove this reasons
   *                                 from previous actions.
   * @return {Promise<Meta|fale>} Promise with `meta` if action was added
   *                              to log or `false` if action was already in log
   *
   * @example
   * removeButton.addEventListener('click', () => {
   *   log.add({ type: 'users:remove', user: id })
   * })
   */
  add: function add (action, meta) {
    if (typeof action.type === 'undefined') {
      throw new Error('Expected "type" in action')
    }

    if (!meta) meta = { }

    var newId = false
    if (typeof meta.id === 'undefined') {
      newId = true
      meta.id = this.generateId()
    }

    if (typeof meta.time === 'undefined') {
      meta.time = parseInt(meta.id)
    }

    if (typeof meta.reasons === 'undefined') {
      meta.reasons = []
    } else if (!Array.isArray(meta.reasons)) {
      meta.reasons = [meta.reasons]
    }

    meta.reasons.forEach(function (reason) {
      if (typeof reason !== 'string') {
        throw new Error('Expected "reasons" to be strings')
      }
    })

    var log = this
    this.emitter.emit('preadd', action, meta)

    if (meta.keepLast) {
      this.removeReason(meta.keepLast, { olderThan: meta })
      meta.reasons.push(meta.keepLast)
    }

    if (meta.reasons.length === 0 && newId) {
      this.emitter.emit('add', action, meta)
      this.emitter.emit('clean', action, meta)
      return Promise.resolve(meta)
    } else if (meta.reasons.length === 0) {
      return this.store.byId(meta.id).then(function (result) {
        if (result[0]) {
          return false
        } else {
          log.emitter.emit('add', action, meta)
          log.emitter.emit('clean', action, meta)
          return meta
        }
      })
    } else {
      return this.store.add(action, meta).then(function (addedMeta) {
        if (addedMeta === false) {
          return false
        } else {
          log.emitter.emit('add', action, addedMeta)
          return addedMeta
        }
      })
    }
  },

  /**
   * Generate next unique action ID.
   *
   * @return {string} Unique action ID.
   *
   * @example
   * const id = log.generateId()
   */
  generateId: function generateId () {
    var now = Date.now()
    if (now <= this.lastTime) {
      now = this.lastTime
      this.sequence += 1
    } else {
      this.lastTime = now
      this.sequence = 0
    }
    return now + ' ' + this.nodeId + ' ' + this.sequence
  },

  /**
   * Iterates through all actions, from last to first.
   *
   * Return false from callback if you want to stop iteration.
   *
   * @param {object} [opts] Iterator options.
   * @param {'added'|'created'} [opts.order='created'] Sort entries by created
   *                                                   time or when they was
   *                                                   added to this log.
   * @param {iterator} callback Function will be executed on every action.
   *
   * @return {Promise} When iteration will be finished
   *                   by iterator or end of actions.
   *
   * @example
   * log.each((action, meta) => {
   *   if (compareTime(meta.id, lastBeep) <= 0) {
   *     return false;
   *   } else if (action.type === 'beep') {
   *     beep()
   *     lastBeep = meta.id
   *     return false;
   *   }
   * })
   */
  each: function each (opts, callback) {
    if (!callback) {
      callback = opts
      opts = { order: 'created' }
    }

    var store = this.store
    return new Promise(function (resolve) {
      function nextPage (get) {
        get().then(function (page) {
          var result
          for (var i = page.entries.length - 1; i >= 0; i--) {
            var entry = page.entries[i]
            result = callback(entry[0], entry[1])
            if (result === false) break
          }

          if (result === false || !page.next) {
            resolve()
          } else {
            nextPage(page.next)
          }
        })
      }

      nextPage(store.get.bind(store, opts))
    })
  },

  /**
   * Change action metadata. You will remove action by setting `reasons: []`.
   *
   * @param {string} id Action ID.
   * @param {object} diff Object with values to change in action metadata.
   *
   * @return {Promise<boolean>} Promise with `true` if metadata was changed
   *                            or `false` on unknown ID.
   *
   * @example
   * await process(action)
   * log.changeMeta(action, { status: 'processed' })
   */
  changeMeta: function changeMeta (id, diff) {
    var k
    for (k in diff) {
      if (k === 'id' || k === 'added' || k === 'time' || k === 'subprotocol') {
        throw new Error('Meta "' + k + '" is read-only')
      }
    }

    var emitter = this.emitter
    if (diff.reasons && diff.reasons.length === 0) {
      return this.store.remove(id).then(function (entry) {
        if (entry) {
          for (k in diff) entry[1][k] = diff[k]
          emitter.emit('clean', entry[0], entry[1])
        }
        return !!entry
      })
    } else {
      return this.store.changeMeta(id, diff)
    }
  },

  /**
   * Remove reason tag from action’s metadata and remove actions without reason
   * from log.
   *
   * @param {string} reason Reason’s name.
   * @param {object} [criteria] Actions criteria.
   * @param {number} [criteria.minAdded] Remove reason only for actions
   *                                     with bigger `added`.
   * @param {number} [criteria.maxAdded] Remove reason only for actions
   *                                     with lower `added`.
   * @param {string} [criteria.olderThan] Remove reasons only for actions
   *                                      with bigger `id`.
   * @param {string} [criteria.youngerThan] Remove reason only for actions
   *                                        with lower `id`.
   * @param {string} [criteria.id] Remove reason only for action with `id`.
   *
   * @return {Promise} Promise when cleaning will be finished.
   *
   * @example
   * onSync(lastSent) {
   *   log.removeReason('unsynchronized', { maxAdded: lastSent })
   * }
   */
  removeReason: function removeReason (reason, criteria) {
    if (!criteria) criteria = { }
    var log = this
    return this.store.removeReason(reason, criteria, function (action, meta) {
      log.emitter.emit('clean', action, meta)
    })
  },

  /**
   * Does log already has action with this ID.
   *
   * @param {string} id Action ID.
   *
   * @return {Promise<Entry|Nope>} Promise with entry.
   *
   * @example
   * if (action.type === 'logux/undo') {
   *   const [undidAction, undidMeta] = await log.byId(action.id)
   *   log.changeMeta(meta.id, { reasons: undidMeta.reasons })
   * }
   */
  byId: function byId (id) {
    return this.store.byId(id)
  }
}

module.exports = Log

/**
 * @callback iterator
 * @param {Action} action Next action.
 * @param {Meta} meta Next action’s metadata.
 * @return {boolean} returning `false` will stop iteration.
 */
