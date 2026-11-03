# OpenVox for Visual Studio Code

OpenVox language support for Visual Studio Code, with syntax highlighting, snippets, diagnostics, code completion,
navigation, and formatting for the Puppet DSL.

## Features

- Syntax highlighting and language detection for Puppet manifests (`.pp`), EPP templates (`.epp`), and
  `Puppetfile` files.
- Live parser and lint diagnostics while you edit.
- Code completion for classes, resources, functions, facts, variables, and language keywords.
- Hover documentation and function signature help.
- Go to Definition, document symbols, and workspace symbols.
- Document formatting with the bundled `puppet-lint`, on-type formatting, and code folding.
- Snippets for common Puppet DSL constructs, Puppetfile module sources, and module `metadata.json` files.
- An OpenVox status bar item showing the loaded OpenVox, OpenFact, and language-server versions.

Syntax highlighting, language detection, snippets, and editor configuration work without a local OpenVox runtime.
Language intelligence and formatting are provided by the bundled
[`openvox-editor-services`](https://github.com/voxpupuli/openvox-editor-services) language server and require the
OpenVox Agent.

## Requirements

Install the [OpenVox Agent](https://voxpupuli.org/openvox/install/) on the machine where the VS Code extension host runs.
For local VS Code this is your workstation; for Remote SSH, a dev container, or WSL it is the remote environment.

The extension uses the Agent's Ruby runtime and its `openvox` and `openfact` gems. It automatically checks the standard OpenVox installation location.
If the Agent is installed elsewhere, configure its installation root:

```json
{
  "openvox.languageServer.installDirectory": "/path/to/openvox/installation"
}
```

Reload the VS Code window after changing runtime or language-server settings.

## Installation

1. Open the Extensions view in Visual Studio Code.
2. Search for `OpenVox`.
3. Select the extension published by Vox Pupuli and choose **Install**.
4. Open a Puppet manifest or a workspace containing an OpenVox module.

You can also install it from the command line:

```shell
code --install-extension voxpupuli.openvox-vscode
```

For manual installation, download a `.vsix` file from the
[GitHub releases](https://github.com/voxpupuli/openvox-vscode/releases) and run **Extensions: Install from VSIX...**
from the Command Palette.

## Configuration

The defaults work with a standard OpenVox Agent installation. The following settings are available for customizing the
runtime, editor behavior, or logging:

| Setting | Default | Purpose |
| --- | --- | --- |
| `openvox.languageServer.enabled` | `true` | Enables language-server features. |
| `openvox.languageServer.installDirectory` | standard Agent location | Sets the OpenVox Agent installation root. |
| `openvox.languageServer.path` | bundled server | Uses a custom `openvox-languageserver` executable. |
| `openvox.languageServer.rubyCommand` | Agent Ruby | Uses a custom Ruby executable to start the server. |
| `openvox.languageServer.timeout` | `10` | Sets the client connection timeout in seconds. |
| `openvox.languageServer.logLevel` | `normal` | Sets extension logging to `debug`, `normal`, `warning`, or `error`. |
| `openvox.languageServer.debugFilePath` | empty | Writes a language-server debug log to the specified file. |
| `openvox.editorService.formatOnType.enable` | `true` | Enables on-type formatting, such as hash-rocket alignment while typing. |
| `openvox.editorService.formatOnType.maxFileSize` | `16384` | Sets the maximum file size in bytes for on-type formatting; `0` disables the limit. |
| `openvox.editorService.foldingRange.enable` | `true` | Enables syntax-aware code folding. |
| `openvox.editorService.foldingRange.showLastLine` | `true` | Keeps the last line of a folded region visible. |
| `openvox.validate.resolvePuppetfiles` | `true` | Resolves Puppetfile dependencies during validation. Disable to avoid dependency resolution and network access. |
| `openvox.format.puppetLint.enabled` | `true` | Formats manifests with the bundled `puppet-lint --fix`. |
| `openvox.puppet.confdir` | empty | Passes a custom OpenVox configuration directory to the server. |
| `openvox.puppet.environment` | empty | Selects the OpenVox environment used for workspace data. |
| `openvox.puppet.modulePath` | empty | Adds an OpenVox module path. |
| `openvox.puppet.vardir` | empty | Passes a custom OpenVox cache directory to the server. |

Editor settings take effect without reloading the VS Code window. Runtime and language-server settings require a window
reload.

## Commands

Open the Command Palette and use:

- **OpenVox: Show Language Server Logs** to inspect startup, runtime, and language-server messages.
- **OpenVox: Restart Language Server** to restart a running server.

The OpenVox item in the status bar also opens the language-server logs. Its tooltip shows which OpenVox, OpenFact, and
language-server versions are active and whether workspace data has finished loading.

## Formatting

Format Document runs the `puppet-lint` bundled with the OpenVox language server. No project `Gemfile` or external
`puppet-lint` executable is required.

- Formatting applies `puppet-lint --fix` and therefore can change more than whitespace, including quote style, boolean
  quoting, file modes, and legacy facts.
- Checks are configured with a `.puppet-lint.rc` file in the workspace root. For example:

  ```text
  --only-checks trailing_whitespace,arrow_alignment
  ```

- The available checks and their behavior follow the `puppet-lint` version bundled with `openvox-editor-services`.
- Format-on-save works through the standard VS Code `editor.formatOnSave` setting.
- On-type formatting aligns hash rockets when you type `=>`. It requires spaces for indentation, which is the default
  for Puppet files in this extension.
- Only `.pp` manifests are formatted. `.epp` templates and `Puppetfile` files are not changed by `puppet-lint`.
- Set `openvox.format.puppetLint.enabled` to `false` to use the language server's basic formatter instead.
  `openvox.editorService.formatOnType.maxFileSize` limits that basic formatter, but not `puppet-lint` formatting.
- Formatting requires the OpenVox language server to be running.

## Troubleshooting

If the status bar shows **OpenVox missing**, verify that the OpenVox Agent is installed in the same local or remote environment as the extension host.
For a non-standard installation, set `openvox.languageServer.installDirectory` and reload the VS Code window.

Use **OpenVox: Show Language Server Logs** for detailed startup errors. Even when the language server cannot start,
syntax highlighting, snippets, language detection, and editor configuration remain available. Formatting is unavailable
because it runs inside the language server.

Please report reproducible problems in the
[`openvox-vscode` issue tracker](https://github.com/voxpupuli/openvox-vscode/issues) and include the relevant log output.

## Current scope

This extension focuses on editing the OpenVox Puppet DSL. It does not provide PDK integration, project scaffolding,
a debugger, Forge integration, a node graph, rename or references support, or telemetry.

OpenVox retains Puppet-compatible language identifiers and runtime APIs.
The extension therefore uses the VS Code language ID `puppet`, the TextMate scope `source.puppet`, and compatible `puppet/*` language-server requests.

## Development

Building from source requires Node.js 20 and Ruby 3.4 or newer:

```shell
npm ci
npm run check
```

Create a local VSIX with:

```shell
npm run package
```

The build downloads the `openvox-editor-services` version pinned in `package.json` from RubyGems and vendors it into the extension package.

## Acknowledgements and license

This project is a fork and reimplementation of the
[`puppet-vscode`](https://github.com/puppetlabs/puppet-vscode) extension originally maintained by Puppet, Inc.

The extension is licensed under the [GNU General Public License v3.0 or later](LICENSE).
Vendored third-party components remain under the licenses listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
