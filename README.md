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

Same as [got#options](https://github.com/sindresorhus/got#goturl-options)

The resolved response echoes back `followRedirect`, so it can be handed straight to `reachableUrl.isReachable`.

### reachableUrl.isReachable(response)

#### response

*Required*<br>
Type: `object`

The response returned by `reachableUrl`. Only `statusCode` and `followRedirect` are read.

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

`followRedirect` defaults to `true`, so a partial `{ statusCode }` object is judged as if redirects were being followed.

## License

**reachable-url** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/reachable-url/blob/master/LICENSE.md) License.<br>
Authored and maintained by Kiko Beats with help from [contributors](https://github.com/Kikobeats/reachable-url/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · X [@Kikobeats](https://x.com/Kikobeats)
