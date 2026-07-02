# OpenVox Visual Studio Code Extension

This extension provides syntax highlighting and Language Server Protocol support
for the OpenVox Puppet DSL.

It is a fork/reimplementation of the [Puppet VSCode](https://github.com/puppetlabs/puppet-vscode) extension.
The original extension is maintained by Puppet, Inc.

## Scope

The initial version intentionally contains no PDK integration, project
scaffolding, telemetry, debugger, Forge integration, or node graph UI.

Language intelligence is provided by the `openvox-editor-services` gem and
syntax highlighting by `openvox-editor-syntax`. The language server is vendored
from RubyGems at build time; the syntax grammar is vendored from a local
checkout.

Puppetfiles use the dedicated Ruby TextMate grammar retained in
`syntaxes/puppetfile.cson.json`. It is tracked in this repository so Puppetfile
highlighting does not depend on a separately installed Ruby extension.

The extension also includes static snippets for common OpenVox Puppet DSL
constructs, Puppetfile module sources, and module `metadata.json`. These are
editor templates only and do not require PDK or scaffolding support.
Additional OpenVox-native snippets cover resources, class declarations,
lookups, facts, selectors, lambdas, functions, type aliases, heredocs, and
resource relationship chains.

## Requirements

The OpenVox Agent must be installed on the machine where the VS Code extension
host runs. It provides the Ruby runtime, the `openvox` gem, the `openfact` gem,
and the parser APIs used by the Language Server.

Without the OpenVox Agent, static functionality still works:

- syntax highlighting;
- language detection;
- snippets;
- bracket and comment handling.

Completion, diagnostics, hover information, definitions, symbols, and other
Language Server features require the Agent. At startup the extension verifies
that the selected Ruby runtime can load both the `openvox` and `openfact` gems
and reports a clear error if either is unavailable.

If the Agent is installed outside its standard location, configure:

```json
{
  "openvox.languageServer.installDirectory": "/path/to/openvox/installation"
}
```

An extension cannot declare an operating-system package as a VS Code
dependency. VS Code's `extensionDependencies` mechanism only installs other
VS Code extensions; it cannot install or manage the OpenVox Agent.

## Development

Expected sibling repositories:

```text
vscode/
├── openvox-vscode/
└── openvox-editor-syntax/
```

Then build the extension:

```shell
npm install
npm run build
```

The build installs the `openvox-editor-services` version declared in
`package.json` under `openvoxDependencies` from RubyGems into
`vendor/languageserver/gems`. Renovate updates this version through
`renovate.jsonc`, using the RubyGems datasource.

For a local one-off test, the pinned version can be overridden without editing
`package.json`:

```shell
OPENVOX_EDITOR_SERVICES_VERSION=3.0.1 npm run vendor
```

An alternative syntax checkout can be selected with
`OPENVOX_EDITOR_SYNTAX_DIR`.

OpenVox currently retains the Puppet Ruby namespace and executable layout.
Therefore the extension keeps the VS Code language ID `puppet`, the TextMate
scope `source.puppet`, and the existing `puppet/*` custom Language Server
requests for compatibility.

The Language Server explicitly activates the `openvox` gem and then loads its
runtime through Ruby's `require 'puppet'`. This is intentional: the OpenVox gem provides the compatible
`lib/puppet.rb` entry point, `Puppet` namespace, parser APIs, and
`Puppet.version`. The status bar queries `puppet/getVersion` and displays the
gem name and version that were actually loaded, together with the OpenFact gem,
its Facter-compatible API version, and the Language Server version in its tooltip.

OpenFact intentionally keeps the Ruby entry point `require 'facter'`, the
`Facter` namespace, the `facter` executable, and the packaged `facter`
directory. These compatibility names do not mean that the legacy `facter` gem
is used: startup explicitly activates and verifies the `openfact` gem.

When the bundled OpenVox Agent Ruby is selected automatically, inherited
Bundler, RVM, and RubyGems paths are removed to prevent native gems from a
different Ruby installation being loaded. A user-supplied `rubyCommand` keeps
the caller's gem environment unchanged.

## Current compatibility boundary

The editor service still requests dynamic settings from the
`puppet` configuration section. It is using the editor-service
defaults for folding and on-type formatting. Moving those settings to
`openvox.*` requires a corresponding change in the editor-services fork.

## License

The code in this repository is licensed under the GNU General Public License v3.0 or later (`GPL-3.0-or-later`).
Vendored third-party components remain under their respective licenses documented in `THIRD_PARTY_NOTICES.md`.
