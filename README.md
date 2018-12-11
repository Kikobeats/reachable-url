# reachable-url

![Last version](https://img.shields.io/github/tag/Kikobeats/reachable-url.svg?style=flat-square)
[![Build Status](https://img.shields.io/travis/Kikobeats/reachable-url/master.svg?style=flat-square)](https://travis-ci.org/Kikobeats/reachable-url)
[![Coverage Status](https://img.shields.io/coveralls/Kikobeats/reachable-url.svg?style=flat-square)](https://coveralls.io/github/Kikobeats/reachable-url)
[![Dependency status](https://img.shields.io/david/Kikobeats/reachable-url.svg?style=flat-square)](https://david-dm.org/Kikobeats/reachable-url)
[![Dev Dependencies Status](https://img.shields.io/david/dev/Kikobeats/reachable-url.svg?style=flat-square)](https://david-dm.org/Kikobeats/reachable-url#info=devDependencies)
[![NPM Status](https://img.shields.io/npm/dm/reachable-url.svg?style=flat-square)](https://www.npmjs.org/package/reachable-url)
[![Donate](https://img.shields.io/badge/donate-paypal-blue.svg?style=flat-square)](https://paypal.me/Kikobeats) [![Greenkeeper badge](https://badges.greenkeeper.io/Kikobeats/reachable-url.svg)](https://greenkeeper.io/)

> Given an url resolve it as fast as possible.

Given an URL, it will be resolved fastest as possible.

It will be performing different HTTP requests in parallel (GET, HEAD) and it will return the first response to respond.

Because of that, don't use this module for consume `body` because it not always be available.

## Install

```bash
$ npm install reachable-url --save
```

## Usage

```js
;(async () => {
  const reachableUrl = require('reachable-url')
  const { url } = await reachableUrl('https://googe.com', { folloRedirects: false })
})()
```

## API

### reachableUrl(input, [options])

#### url

*Required*<br>
Type: `string`

The target URL to be resolved.

#### options

Same as [got#options](https://github.com/sindresorhus/got#goturl-options)

## License

**reachable-url** © [Kiko Beats](https://kikobeats.com), released under the [MIT](https://github.com/Kikobeats/reachable-url/blob/master/LICENSE.md) License.<br>
Authored and maintained by Kiko Beats with help from [contributors](https://github.com/Kikobeats/reachable-url/contributors).

> [kikobeats.com](https://kikobeats.com) · GitHub [Kiko Beats](https://github.com/Kikobeats) · Twitter [@Kikobeats](https://twitter.com/Kikobeats)
