# Third-party components

The OpenVox VS Code extension itself is licensed under `AGPL-3.0-only`.
The packaged extension vendors the following components under their own
licenses:

- `openvox-editor-services`, derived from `puppet-editor-services` and licensed
  under Apache-2.0.
- `syntaxes/puppet.tmLanguage`, copied from `openvox-editor-syntax`, derived
  from `puppet-editor-syntax`, and licensed under MIT. Its upstream license and
  notice are tracked as `LICENSE.editor-syntax` and `NOTICE.editor-syntax`.
- `syntaxes/puppetfile.cson.json` was carried over from `puppet-vscode`. The
  file identifies its original source as the Ruby grammar from
  `rubyide/vscode-ruby`, based on Atom `language-ruby` commit
  `f4082a02f467f8b253449d6998226fdea0957efa`. Existing attribution metadata is
  retained in the grammar.
- The initial language, Puppetfile, and metadata snippets were adapted from
  `puppet-vscode`, licensed under Apache-2.0. OpenVox-specific additions and
  modifications are licensed as part of this project under AGPL-3.0-only.
- Runtime Ruby libraries listed in
  `vendor/languageserver/vendor/README.md`, with their respective upstream
  licenses retained in the vendored source trees.

The VS Code language identifier `puppet`, TextMate scope `source.puppet`, Ruby
namespace `Puppet`, and `puppet/*` protocol method names are retained as
technical compatibility identifiers. They do not indicate endorsement by or
affiliation with Perforce or Puppet.
