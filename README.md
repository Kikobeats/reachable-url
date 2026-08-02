# reachable-url

![Last version](https://img.shields.io/github/tag/Kikobeats/reachable-url.svg?style=flat-square)
[![Coverage Status](https://img.shields.io/coveralls/Kikobeats/reachable-url.svg?style=flat-square)](https://coveralls.io/github/Kikobeats/reachable-url)
[![NPM Status](https://img.shields.io/npm/dm/reachable-url.svg?style=flat-square)](https://www.npmjs.org/package/reachable-url)

> Given an URL, it resolves as fast as possible, performing a GET without downloading the body.

## Install

```bash
$ npm install reachable-url --save
```

## Usage

```js
const reachableUrl = require('reachable-url')

reachableUrl.isReachable(await reachableUrl('https://google.com')) // => true
```

## API

### reachableUrl(input, [options])

#### url

*Required*<br>
Type: `string`

The target URL to be resolved.

#### options

Same as [got#options](https://github.com/sindresorhus/got#goturl-options), plus:

##### maxBody

Type: `number`<br>
Default: `0`

How many bytes of the body to keep before the download is cancelled.

The default answers reachability from the status and headers alone, never reading a body. Ask for more when the bytes themselves decide something:

```js
// one byte is enough to tell an image from an HTML error page served as one
const response = await reachableUrl('https://example.com/favicon.png', { maxBody: 1 })
response.body[0] === 60 // => `<`, so the server answered with markup
```

Asking for more than one byte drops the `Range` header, since a server that honors it would answer with just that byte. `Infinity` is the extreme of that, and keeps the whole entity:

```js
const response = await reachableUrl('https://example.com/favicon.svg', { maxBody: Infinity })
response.body // => the whole entity
```

Passing `cache` keeps the whole body too, since a cache entry is only written once the body has been read in full:

```js
const cache = new Map()
const response = await reachableUrl('https://example.com/video.mp4', { cache })
response.body // => the whole entity, so it can be cached
```

`cache` needs [@kikobeats/cacheable-request](https://github.com/Kikobeats/cacheable-request): the version [got](https://github.com/sindresorhus/got) pulls in never settles when the origin keeps the connection alive, and no timeout recovers from it. Declare the override, otherwise passing `cache` throws:

```yaml
# pnpm-workspace.yaml
overrides:
  got>cacheable-request: npm:@kikobeats/cacheable-request
```

#### returns

The [got response](https://github.com/sindresorhus/got#response), plus `requestUrl`, `redirectUrls`, `redirectStatusCodes` and the `followRedirect` in effect.

The request asks for a single byte ([`Range: bytes=0-0`](#maxbody)). When a server ignores that and starts sending the whole entity, the download is cancelled: the status and headers already say whether the URL is reachable, so `body` is `undefined` on those responses unless [`maxBody`](#maxbody) asked for some of it.

A `206` that did answer the range is reported as the `200` it stands for, with `content-length` taken from `content-range`.

### reachableUrl.isReachable(response)

#### response

*Required*<br>
Type: `object`

The response returned by `reachableUrl`, which echoes back `followRedirect` so it can be handed straight over.

A URL is reachable when the response is a final 2xx.

A redirect status is the final answer only when redirects were not being followed:

```js
const response = await reachableUrl('https://example.com', { followRedirect: false })
reachableUrl.isReachable(response) // => true, the 3xx is the destination
```

With redirect following on (the default), a 3xx is the hop the follow stopped at (a `beforeRedirect` hook threw, `maxRedirects` ran out), meaning the URL was never reached:

```js
const response = await reachableUrl('https://example.com', {
  hooks: { beforeRedirect: [() => { throw new Error('refused') }] }
})
reachableUrl.isReachable(response) // => false
```

A partial object missing `followRedirect` is judged as if redirects were being followed, so a bare `{ statusCode: 302 }` is unreachable.

## License

**reachable-url** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/reachable-url/blob/master/LICENSE.md) License.<br>
Authored and maintained by Kiko Beats with help from [contributors](https://github.com/Kikobeats/reachable-url/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · X [@Kikobeats](https://x.com/Kikobeats)
