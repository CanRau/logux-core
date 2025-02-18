# Change Log
This project adheres to [Semantic Versioning](http://semver.org/).

## 0.3.3
* Fix JSDoc.

## 0.3.2
* Fix read-only meta keys.

## 0.3.1
* Fix using old `added` in `sync` message.

## 0.3 Ω
* Rename project from `logux-core` to `@logux/core`.
* Remove Node.js 6 and 8 support.
* Merge with `logux-sync`.
* Merge with `logux-store-tests`.
* Use sting-based `meta.id`.
* Rename `BaseSync`, `ClientSync`, `ServerSync` to `*Node`.
* Rename `SyncError` to `LoguxError`.
* Remove `missed-auth` error.
* Rename `BrowserConnection` to `WsConnection`.
* Run input map before filter.
* Add `Store#clean()` (by Arthur Kushka).
* Add `criteria.id` to `Store#removeReason`.
* Add `TestTime#lastId`.
* Add `TestLog#entries` and `TestLog#actions`.
* Use more events for `Reconnect`.
* Do not throw on `wrong-subprotocol`, `wrong-protocol`, and `timeout`.
* Allow to send debug before authentication.
* Move all Logux docs to singe place.

## 0.2.2
* Allow to set `meta.keepLast` in `preadd` event listener.

## 0.2.1
* Fix removing action with different `time` from memory store.

## 0.2 Ѣ
* Rename `meta.created` to `meta.id`.
* Rename `event` event to `add`.
* Use reasons of life API to clean log.
* Return new action `meta` in `Log#add`.
* Deny tab symbol in Node ID.
* Add `preadd` event.
* Add `TestTime`.
* Add `keepLast` option to `Log#add` (by Igor Deryabin).
* Add `meta.time` for `fixTime` feature.
* Add `isFirstOlder()` helper.
* Add `changeMeta`, `removeReason` and `byId` to store.
* Add `getLastAdded`, `getLastSynced` and `setLastSynced` method to store.
* Fix leap second problem.
* Move store tests to separated project (by Konstantin Mamaev).
* Fix docs (by Grigoriy Beziuk, Andrew Romanov and Alexey Gaziev).

## 0.1 𐤀
* Initial release.
