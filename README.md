# Wishlephant Browser extension

This is the code for the [wishlephant](https://wishlephant.com) browser extension.

* [Install in Firefox](https://addons.mozilla.org/en-US/firefox/addon/wishlephant/?src=search)
* *Chrome will follow soon.*

Alternatively you can install [this](https://www.icloud.com/shortcuts/d2bc9187df2349a7a1417976dd2b795b)
iOS shortcut or create a bookmark with this link:

```js
javascript:;void(open('https://wishlephant.com/add_entry?url='+encodeURIComponent(location.href),'_blank'));
```

## Development

To start it in development mode simply run this:

```sh
yarn install
yarn run-firefox # for firefox
yarn run-chrome # for chrome
```

## Release

To build the zip file for publishing in the chrome/firefox stores run
this task: 

```sh
yarn build
````
