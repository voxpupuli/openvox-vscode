import { access } from 'node:fs/promises';

const requiredPaths = [
  '../out/extension.js',
  '../out/messages.js',
  '../syntaxes/puppet.tmLanguage',
  '../syntaxes/puppetfile.cson.json',
  '../snippets/keywords.snippets.json',
  '../snippets/openvox.snippets.json',
  '../snippets/metadata.snippets.json',
  '../snippets/puppetfile.snippets.json',
  '../vendor/languageserver/openvox-languageserver',
  '../vendor/languageserver/openvox-languageserver-sidecar',
  '../vendor/languageserver/gems',
  '../vendor/languageserver/lib/puppet_languageserver.rb',
];

for (const requiredPath of requiredPaths) {
  await access(new URL(requiredPath, import.meta.url));
}

console.log('Package contents are present.');
