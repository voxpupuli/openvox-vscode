import { access, cp, mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const syntaxRoot = path.resolve(
  process.env.OPENVOX_EDITOR_SYNTAX_DIR ?? path.join(projectRoot, '..', 'openvox-editor-syntax'),
);
const languageServerTarget = path.join(projectRoot, 'vendor', 'languageserver');
const languageServerGemHome = path.join(languageServerTarget, 'gems');
const languageServerGemBin = path.join(languageServerTarget, 'gem-bin');
const syntaxTarget = path.join(projectRoot, 'syntaxes', 'puppet.tmLanguage');
const editorServicesGem = 'openvox-editor-services';
const editorServicesVersion = process.env.OPENVOX_EDITOR_SERVICES_VERSION
  ?? packageJson.openvoxDependencies?.[editorServicesGem];

if (!editorServicesVersion) {
  throw new Error(`Missing ${editorServicesGem} version in package.json openvoxDependencies.`);
}

const requiredExecutablePaths = [
  'openvox-languageserver',
  'openvox-languageserver-sidecar',
];
const editorServicesInstallRoot = path.join(languageServerGemHome, 'gems', `${editorServicesGem}-${editorServicesVersion}`);

await rm(languageServerTarget, { recursive: true, force: true });
await rm(syntaxTarget, { force: true });
await mkdir(languageServerTarget, { recursive: true });
await mkdir(path.dirname(syntaxTarget), { recursive: true });

const gemInstall = spawnSync(
  'gem',
  [
    'install',
    editorServicesGem,
    '--version',
    editorServicesVersion,
    '--install-dir',
    languageServerGemHome,
    '--bindir',
    languageServerGemBin,
    '--no-document',
    '--clear-sources',
    '--source',
    'https://rubygems.org',
  ],
  {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  },
);

if (gemInstall.error) {
  throw gemInstall.error;
}
if (gemInstall.status !== 0) {
  throw new Error(`Unable to install ${editorServicesGem} ${editorServicesVersion}.`);
}

for (const relativePath of requiredExecutablePaths) {
  await access(path.join(languageServerGemBin, relativePath));
}
await access(path.join(editorServicesInstallRoot, 'lib', 'puppet_languageserver.rb'));

for (const relativePath of requiredExecutablePaths) {
  await cp(path.join(languageServerGemBin, relativePath), path.join(languageServerTarget, relativePath));
}
await rm(languageServerGemBin, { recursive: true, force: true });
await cp(path.join(editorServicesInstallRoot, 'lib'), path.join(languageServerTarget, 'lib'), { recursive: true });
await cp(path.join(editorServicesInstallRoot, 'LICENSE'), path.join(languageServerTarget, 'LICENSE'));

await cp(path.join(syntaxRoot, 'syntaxes', 'puppet.tmLanguage'), syntaxTarget);
await cp(path.join(syntaxRoot, 'LICENSE'), path.join(projectRoot, 'LICENSE.editor-syntax'));
await cp(path.join(syntaxRoot, 'NOTICE'), path.join(projectRoot, 'NOTICE.editor-syntax'));

console.log(`Vendored ${editorServicesGem} ${editorServicesVersion} from RubyGems`);
console.log(`Vendored editor syntax from ${syntaxRoot}`);
