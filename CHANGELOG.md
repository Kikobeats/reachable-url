# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## 2.1.0 (2026-08-02)


### Features

* add maxBody to keep part of an aborted download ([#78](https://github.com/Kikobeats/reachable-url/issues/78)) ([7e0c676](https://github.com/Kikobeats/reachable-url/commit/7e0c676257c8831ea3ac0e3703e1231d3ee13eb3))

## 2.0.0 (2026-08-02)


### ⚠ BREAKING CHANGES

* `body` is `undefined` on responses whose download was
aborted. Pass `cache` to keep the previous behaviour.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018JDsM3McLV5LtR3rFd97Sb

* feat: reject the cache option without the patched cacheable-request

The cacheable-request got resolves never settles when the origin keeps
the connection alive, and got's own timeout does not fire, so the request
hangs with no stack and nothing to grep for. An override redirects it to
@kikobeats/cacheable-request, but overrides do not reach consumers of
this package, and the pnpm one silently stopped applying once pnpm moved
that setting out of package.json.

Throw instead, naming the override that fixes it. Only when `cache` is
passed, since that is the only path that hangs.

Detection reads the module shape rather than its resolved path, because a
path can be rewritten by bundlers and aliases: upstream is a class
exposing `createCacheableRequest`, the patched one a factory function.
A lookup that fails counts as patched, since refusing to run a working
setup is worse than missing the warning.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018JDsM3McLV5LtR3rFd97Sb

* test: drop the instagram prerender test

instagram.com answers 429 to the shared GitHub Actions IP pool, so the
test flaps: red on master, green twice earlier the same day. It asserted
a 200 status and `isReachable`, both already covered by `resolve GET
request` and the redirect tests, and never asserted anything about
prerendering.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018JDsM3McLV5LtR3rFd97Sb

* refactor: simplify the ignored-Range abort

Read got's own retry status codes off the request instead of restating
5xx, so a caller's `retry` option is honored and 408/413/429 are not
cancelled mid-retry.

Fill `phases.total` where the cancel happens, which drops the post-hoc
timings patch. Resolve cacheable-request once at load instead of on every
cached call. Align the override snippet with pnpm-workspace.yaml.

Move the ignore-Range server into test/_helpers.js as a Buffer payload,
and the caching test next to its siblings in test/cache.js.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017hKwmRfQw3NWT7cNheVT2f

* refactor: express the abort condition as got's own retry decision

`willRetry` only mirrored got's status codes, so the final attempt of a
retryable 5xx was never cancelled: the very case the abort exists for.
Add the exhaustion and method clauses. A doubled 500 with an 8 MB body
drops from 16.00 MB to 8.06 MB transferred.

Identify cacheable-request by package name instead of prototype shape.
The override is an alias, so the manifest names the package it resolved,
which is what the error message claims; the shape check would misfire if
the fork ever became a class again.

Take the response from the `response` event rather than merging it over
the settled value, which carried the previous attempt's fields. Clearing
`body` left `rawBody` holding the earlier attempt's payload; there is
nothing left to subtract now.

Fold createIgnoreRangeServer back into createAssetServer.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017hKwmRfQw3NWT7cNheVT2f

* refactor: drop p-reflect and the test-only server hook

`p-reflect` was down to one destructured field after the response merge
changed; a native rejection handler is the same line without the runtime
dependency.

`createAssetServer`'s `intercept` hook was a second dispatch layer over
the handler `createTestServer` already takes, and the 5xx test answered
every request through it, leaving the helper's own body path dead. The
abort tests build their servers directly.

Close the last gap in `willRetry`: got declines a 413 without a
`retry-after` outright, so that response is abortable too.

Move the `body` note out of the options section into `returns`, next to
the 206 normalization it sits beside.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017hKwmRfQw3NWT7cNheVT2f

* refactor: read the cache option off the request

Every other clause of `shouldAbortDownload` is a fact about the response;
`cache` was threaded in from the call site, so the predicate was partial
over its own subject. got's normalized options carry it.

Drop the manifest memo: it saved 4us on calls that pass `cache`, at the
price of module-level mutable state.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017hKwmRfQw3NWT7cNheVT2f

* refactor: name the requested range length

`bytes=0-0` and the `<= 1` in honoredRange were the same fact written
twice, with nothing tying them together.

Bind only the response the rejection carries, and call the result what it
is now that nothing is merged.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017hKwmRfQw3NWT7cNheVT2f

* refactor: bind only the response a rejection carries

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017hKwmRfQw3NWT7cNheVT2f

* test: make 'resolve as fast a HEAD' deterministic

It compared two live requests to edge-ping.vercel.app on wall clock with
a 2x margin and a single sample, so CI jitter alone could fail it. That
is what happened on e17b2ca.

A local server that announces a body and never sends it states the same
claim without a clock race: the call has to resolve at the headers. On
master it hangs to the timeout and retries, 7077ms and two hits; here it
is 8ms and one.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_017hKwmRfQw3NWT7cNheVT2f

### Bug Fixes

* abort the download when a server ignores Range ([#77](https://github.com/Kikobeats/reachable-url/issues/77)) ([d6f7a3c](https://github.com/Kikobeats/reachable-url/commit/d6f7a3c9d38ff60679c4eedbc72cb71cb4748b3b))

### 1.8.4 (2026-08-02)


### Bug Fixes

* restore the cacheable-request override and make the suite deterministic ([#75](https://github.com/Kikobeats/reachable-url/issues/75)) ([dfdb5c9](https://github.com/Kikobeats/reachable-url/commit/dfdb5c99dc6ae487fa58fd45ecff6ba47ffcee2a))

### 1.8.3 (2025-09-05)

### 1.8.2 (2025-06-28)

### 1.8.1 (2024-05-11)

## [1.8.0](https://github.com/Kikobeats/reachable-url/compare/v1.7.2...v1.8.0) (2024-02-10)


### Features

* resolve CDN URLs ([2423f16](https://github.com/Kikobeats/reachable-url/commit/2423f163cdeac87738f7a140949f18dca17b8d2f))

### 1.7.2 (2023-10-24)

### 1.7.1 (2022-09-26)

## [1.7.0](https://github.com/Kikobeats/reachable-url/compare/v1.6.11...v1.7.0) (2022-09-24)


### Bug Fixes

* disable compression ([8fc0826](https://github.com/Kikobeats/reachable-url/commit/8fc08260898d9b923681377fbebb6027d981419d))

### 1.6.11 (2022-05-17)

### 1.6.10 (2022-04-12)

### 1.6.9 (2022-04-08)

### 1.6.8 (2022-03-24)

### 1.6.7 (2022-03-02)

### 1.6.6 (2022-02-25)

### 1.6.5 (2021-12-26)

### 1.6.4 (2021-12-26)

### [1.6.3](https://github.com/Kikobeats/reachable-url/compare/v1.6.2...v1.6.3) (2021-09-08)


### Bug Fixes

* abort after first data event ([0167102](https://github.com/Kikobeats/reachable-url/commit/01671027170f9e7a1d6eb54d7f0336e97201bf40))

### [1.6.2](https://github.com/Kikobeats/reachable-url/compare/v1.6.1...v1.6.2) (2021-09-08)

### [1.6.1](https://github.com/Kikobeats/reachable-url/compare/v1.6.0...v1.6.1) (2021-09-06)

## [1.6.0](https://github.com/Kikobeats/reachable-url/compare/v1.5.1...v1.6.0) (2021-07-17)


### Features

* only perform GET requests ([b2e090d](https://github.com/Kikobeats/reachable-url/commit/b2e090d3606140fff7aab3af75c32197bb228ee3))

### [1.5.1](https://github.com/Kikobeats/reachable-url/compare/v1.5.0...v1.5.1) (2021-06-29)


### Bug Fixes

* keep original request url ([d259242](https://github.com/Kikobeats/reachable-url/commit/d25924200a78e36fd21c90eee2d63d03c4c799d2))

## [1.5.0](https://github.com/Kikobeats/reachable-url/compare/v1.4.20...v1.5.0) (2021-06-28)


### Features

* ensure to don't download body ([f3a73ba](https://github.com/Kikobeats/reachable-url/commit/f3a73bac77e6b516fd36e98df082b76f42dbf388))

### [1.4.20](https://github.com/Kikobeats/reachable-url/compare/v1.4.19...v1.4.20) (2020-12-28)

### [1.4.19](https://github.com/Kikobeats/reachable-url/compare/v1.4.18...v1.4.19) (2020-12-07)

### [1.4.18](https://github.com/Kikobeats/reachable-url/compare/v1.4.17...v1.4.18) (2020-12-03)

### [1.4.17](https://github.com/Kikobeats/reachable-url/compare/v1.4.16...v1.4.17) (2020-10-21)

### [1.4.16](https://github.com/Kikobeats/reachable-url/compare/v1.4.15...v1.4.16) (2020-10-21)

### [1.4.15](https://github.com/Kikobeats/reachable-url/compare/v1.4.14...v1.4.15) (2020-09-20)

### [1.4.14](https://github.com/Kikobeats/reachable-url/compare/v1.4.13...v1.4.14) (2020-09-04)

### [1.4.13](https://github.com/Kikobeats/reachable-url/compare/v1.4.12...v1.4.13) (2020-07-18)

### [1.4.12](https://github.com/Kikobeats/reachable-url/compare/v1.4.11...v1.4.12) (2020-07-12)

### [1.4.11](https://github.com/Kikobeats/reachable-url/compare/v1.4.10...v1.4.11) (2020-07-08)

### [1.4.10](https://github.com/Kikobeats/reachable-url/compare/v1.4.9...v1.4.10) (2020-07-04)

### [1.4.9](https://github.com/Kikobeats/reachable-url/compare/v1.4.8...v1.4.9) (2020-06-06)

### [1.4.8](https://github.com/Kikobeats/reachable-url/compare/v1.4.7...v1.4.8) (2020-06-01)

### [1.4.7](https://github.com/Kikobeats/reachable-url/compare/v1.4.6...v1.4.7) (2020-05-04)

### [1.4.6](https://github.com/Kikobeats/reachable-url/compare/v1.4.5...v1.4.6) (2020-04-30)

### [1.4.5](https://github.com/Kikobeats/reachable-url/compare/v1.4.4...v1.4.5) (2020-04-21)

### [1.4.4](https://github.com/Kikobeats/reachable-url/compare/v1.4.3...v1.4.4) (2020-03-26)

### [1.4.3](https://github.com/Kikobeats/reachable-url/compare/v1.4.2...v1.4.3) (2020-02-21)

### [1.4.2](https://github.com/Kikobeats/reachable-url/compare/v1.4.1...v1.4.2) (2020-02-07)

### [1.4.1](https://github.com/Kikobeats/reachable-url/compare/v1.4.0...v1.4.1) (2020-02-03)

## [1.4.0](https://github.com/Kikobeats/reachable-url/compare/v1.3.3...v1.4.0) (2020-02-01)


### Features

* use got@10 ([5370c48](https://github.com/Kikobeats/reachable-url/commit/5370c4886ebe458d14420cc987a13a0ab811a931))

### [1.3.3](https://github.com/Kikobeats/reachable-url/compare/v1.3.2...v1.3.3) (2020-01-28)

### [1.3.2](https://github.com/Kikobeats/reachable-url/compare/v1.3.1...v1.3.2) (2020-01-26)


### Bug Fixes

* identation ([38085f0](https://github.com/Kikobeats/reachable-url/commit/38085f071d2de7ec9ec12488f3a0073cc3eee854))

### [1.3.1](https://github.com/Kikobeats/reachable-url/compare/v1.3.0...v1.3.1) (2020-01-23)

## [1.3.0](https://github.com/Kikobeats/reachable-url/compare/v1.2.4...v1.3.0) (2020-01-22)


### Features

* ensure to resolve prerender urls ([291d809](https://github.com/Kikobeats/reachable-url/commit/291d809))



### [1.2.4](https://github.com/Kikobeats/reachable-url/compare/v1.2.3...v1.2.4) (2020-01-22)


### Build System

* add 404 as fallback status code ([68bbec7](https://github.com/Kikobeats/reachable-url/commit/68bbec7))



### [1.2.3](https://github.com/Kikobeats/reachable-url/compare/v1.2.2...v1.2.3) (2020-01-22)


### Build System

* ensure to handle common statuses ([519e025](https://github.com/Kikobeats/reachable-url/commit/519e025))



### [1.2.2](https://github.com/Kikobeats/reachable-url/compare/v1.2.1...v1.2.2) (2019-12-18)

### [1.2.1](https://github.com/Kikobeats/reachable-url/compare/v1.2.0...v1.2.1) (2019-08-18)

## [1.2.0](https://github.com/Kikobeats/reachable-url/compare/v1.1.9...v1.2.0) (2019-08-10)


### Features

* prefix cdn urls ([b7b3000](https://github.com/Kikobeats/reachable-url/commit/b7b3000))

### 1.1.9 (2019-06-21)


### Bug Fixes

* **package:** update got to version 9.6.0 ([0a2122b](https://github.com/Kikobeats/reachable-url/commit/0a2122b))
* **package:** update p-any to version 2.0.0 ([50ce345](https://github.com/Kikobeats/reachable-url/commit/50ce345))
* **package:** update p-any to version 2.1.0 ([15cdca2](https://github.com/Kikobeats/reachable-url/commit/15cdca2))


### Build System

* add automate release ([82e3477](https://github.com/Kikobeats/reachable-url/commit/82e3477))
* add automate release ([#10](https://github.com/Kikobeats/reachable-url/issues/10)) ([4d08cc5](https://github.com/Kikobeats/reachable-url/commit/4d08cc5))
* ignore envrc ([bd72cf8](https://github.com/Kikobeats/reachable-url/commit/bd72cf8))
* update dependencies ([de1e8d6](https://github.com/Kikobeats/reachable-url/commit/de1e8d6))



### 1.1.8 (2018-12-19)


### Bug Fixes

* **package:** update got to version 9.5.0 ([96b5c32](https://github.com/Kikobeats/reachable-url/commit/96b5c32))



### 1.1.7 (2018-12-11)


### Build System

* update dependencies ([52aaa05](https://github.com/Kikobeats/reachable-url/commit/52aaa05))



### 1.1.6 (2018-09-12)



### 1.1.5 (2018-09-11)



### 1.1.4 (2018-09-09)



### 1.1.3 (2018-08-07)



### 1.1.2 (2018-07-07)



### 1.1.1 (2018-07-07)



## 1.1.0 (2018-07-07)



### 1.0.1 (2018-05-02)



## 1.0.0 (2018-05-01)



<a name="1.1.8"></a>
## 1.1.8 (2018-12-19)

* fix(package): update got to version 9.5.0 ([96b5c32](https://github.com/Kikobeats/reachable-url/commit/96b5c32))
* Update package.json ([ca392e2](https://github.com/Kikobeats/reachable-url/commit/ca392e2))
* Update README.md ([c6c66bf](https://github.com/Kikobeats/reachable-url/commit/c6c66bf))
* docs(readme): add Greenkeeper badge ([fa6928b](https://github.com/Kikobeats/reachable-url/commit/fa6928b))
* chore(package): update dependencies ([c0b5455](https://github.com/Kikobeats/reachable-url/commit/c0b5455))



<a name="1.1.7"></a>
## 1.1.7 (2018-12-11)

* build: update dependencies ([52aaa05](https://github.com/Kikobeats/reachable-url/commit/52aaa05))
* Add already encoded case ([54d7608](https://github.com/Kikobeats/reachable-url/commit/54d7608))
* Add more encoding cases ([6595a11](https://github.com/Kikobeats/reachable-url/commit/6595a11))
* Add query search test ([b4f1162](https://github.com/Kikobeats/reachable-url/commit/b4f1162))
* Update package.json ([11f42d0](https://github.com/Kikobeats/reachable-url/commit/11f42d0))
* Update README.md ([b37539d](https://github.com/Kikobeats/reachable-url/commit/b37539d))



<a name="1.1.6"></a>
## 1.1.6 (2018-09-12)

* Ensure encode url ([87e3456](https://github.com/Kikobeats/reachable-url/commit/87e3456))



<a name="1.1.5"></a>
## 1.1.5 (2018-09-11)

* Avoid parse response ([93a5b39](https://github.com/Kikobeats/reachable-url/commit/93a5b39)), closes [#1](https://github.com/Kikobeats/reachable-url/issues/1)



<a name="1.1.4"></a>
## 1.1.4 (2018-09-09)

* Update dependencies ([a140f62](https://github.com/Kikobeats/reachable-url/commit/a140f62))
* Update package.json ([21e1d96](https://github.com/Kikobeats/reachable-url/commit/21e1d96))



<a name="1.1.3"></a>
## 1.1.3 (2018-08-07)

* Update deps ([ca9ce00](https://github.com/Kikobeats/reachable-url/commit/ca9ce00))



<a name="1.1.2"></a>
## 1.1.2 (2018-07-07)

* Separate redirect urls from status code ([d9df81f](https://github.com/Kikobeats/reachable-url/commit/d9df81f))



<a name="1.1.1"></a>
## 1.1.1 (2018-07-07)

* Refactor ([dafa364](https://github.com/Kikobeats/reachable-url/commit/dafa364))



<a name="1.1.0"></a>
# 1.1.0 (2018-07-07)

* Associate statusCode per each redirect url ([2f6dbf1](https://github.com/Kikobeats/reachable-url/commit/2f6dbf1))



<a name="1.0.1"></a>
## 1.0.1 (2018-05-02)

* Add options test ([58037f7](https://github.com/Kikobeats/reachable-url/commit/58037f7))
* Fixt test ([5772a5e](https://github.com/Kikobeats/reachable-url/commit/5772a5e))
* Refactor ([f5433df](https://github.com/Kikobeats/reachable-url/commit/f5433df))



<a name="1.0.0"></a>
# 1.0.0 (2018-05-01)

* Add files field ([fa46548](https://github.com/Kikobeats/reachable-url/commit/fa46548))
* First commit ([081f7b0](https://github.com/Kikobeats/reachable-url/commit/081f7b0))
