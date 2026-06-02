## CozySSH Plugins

This is the plugins repository for [CozySSH](https://github.com/sagan/cozyssh), a web ssh client & terminal simulator. Plugins uses [CozySSH Scripting API][].

- [CozySSH Plugins](#cozyssh-plugins)
- [Install Plugins](#install-plugins)
- [Write a plugin](#write-a-plugin)
- [Install a plugin from URL](#install-a-plugin-from-url)

## Install Plugins

To install plugins from [CozySSH Plugins](https://github.com/sagan/cozyssh-plugins) you first need to install `Plugin Manager` to CozySSH:

1. Open CozySSH frontend, click the page bottom-right `+` icon of button bar to open `Add Button` dialog.
2. In `Add Button` dialog, click top-right `...` menu and choose `Add Plugin Manager`, it will download `Plugin Manager` script ([CsPluginManager.tsx](https://raw.githubusercontent.com/sagan/cozyssh-plugins/refs/heads/master/CsPluginManager.tsx)) script and fill up the form, click `Save` to confirm install.

After `PluginManager` is installed, click it's button bar button to open `Plugin Manager` dialog UI (by default it's installed to `_Sys` button group). You can then browser and install all plugins here.

## Write a plugin

You can use this repository directly as a template project to write a CozySSH plugin/script.

1. Download the project and Open in VS Code.
2. Run `npm i`. It installs some external dependencies TypeScript type packages.
3. Add a new `MyPlugin.ts` or `MyPlugin.tsx` file and start writing. Code intelligence is automatically ready. See [CozySSH Scripting API][] for detailed guide and API reference.

To test or install a plugin/script in CozySSH instance, just open `Add Button` dialog, enter a name, select `Run Script` button type, fills up the script text arera with the script `.ts` or `.tsx` contents, and click `Save` to add.

## Install a plugin from URL

Alternatively, you can use `Add Button` dialog `...` menu `Add From URL` option, input the script `.ts` or `.tsx` file url to install it.

The `Add From URL` script installing method recognizes some `jsdoc` format meta data comment in script contents. E.g.

```ts
/**
 * @file Plugin Manager.
 * @module PluginManager
 * @author sagan
 * @license BSD-3-Clause
 * @version 1.0.0
 * @since 2026-05-22
 * @id cs-plugin-manager
 * @group _Sys
 */
```

- `@module` field: used as default `Button Name`.
- `@id` field: used as button `Button ID`. Install a new button will overwrite the old same id button.
- `@group` field: used as default `Button Group`.

[CozySSH Scripting API]: https://github.com/sagan/cozyssh/blob/master/docs/SCRIPTS.md
