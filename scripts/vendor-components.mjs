import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'));
const languageServerTarget = path.join(projectRoot, 'vendor', 'languageserver');
const languageServerGemHome = path.join(languageServerTarget, 'gems');
const languageServerGemBin = path.join(languageServerTarget, 'gem-bin');
const editorServicesGem = 'openvox-editor-services';
const localGemPath = process.env.OPENVOX_EDITOR_SERVICES_GEM
  ? path.resolve(projectRoot, process.env.OPENVOX_EDITOR_SERVICES_GEM)
  : undefined;
const editorServicesVersion = process.env.OPENVOX_EDITOR_SERVICES_VERSION
  ?? (localGemPath
    ? path.basename(localGemPath).match(/^openvox-editor-services-(.+)\.gem$/)?.[1]
    : packageJson.openvoxDependencies?.[editorServicesGem]);

if (!editorServicesVersion) {
  throw new Error(
    localGemPath
      ? 'Unable to determine the gem version from its filename. Rename it to openvox-editor-services-<version>.gem or set OPENVOX_EDITOR_SERVICES_VERSION.'
      : `Missing ${editorServicesGem} version in package.json openvoxDependencies.`,
  );
}

if (localGemPath) {
  await access(localGemPath);
}

const requiredExecutablePaths = [
  'openvox-languageserver',
  'openvox-languageserver-sidecar',
];
const editorServicesInstallRoot = path.join(languageServerGemHome, 'gems', `${editorServicesGem}-${editorServicesVersion}`);

await rm(languageServerTarget, { recursive: true, force: true });
await mkdir(languageServerTarget, { recursive: true });

const gemInstall = spawnSync(
  'gem',
  [
    'install',
    ...(localGemPath ? [localGemPath] : [editorServicesGem, '--version', editorServicesVersion]),
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
  throw new Error(`Unable to install ${localGemPath ?? `${editorServicesGem} ${editorServicesVersion}`}.`);
}

// Open VSX flags RBS's URI documentation example as a password.
// Suppress only that known example in the vendored copy:
// https://github.com/eclipse-openvsx/openvsx/wiki/Publishing-Extensions#extension-scanning
const installedGems = path.join(languageServerGemHome, 'gems');
for (const gem of await readdir(installedGems)) {
  if (!gem.startsWith('rbs-')) continue;

  const signaturePath = path.join(installedGems, gem, 'stdlib', 'uri', '0', 'generic.rbs');
  const signature = await readFile(signaturePath, 'utf8');
  const example = '    #     uri.password = "V3ry_S3nsit1ve"';
  if (signature.split(example).length !== 2) {
    throw new Error(`Expected one known URI password example in ${signaturePath}; review the Open VSX workaround.`);
  }
  await writeFile(signaturePath, signature.replace(example, `${example} # secret-detector:ignore`));
}

for (const relativePath of requiredExecutablePaths) {
  await access(path.join(editorServicesInstallRoot, 'bin', relativePath));
}
await access(path.join(editorServicesInstallRoot, 'lib', 'puppet_languageserver.rb'));

for (const relativePath of requiredExecutablePaths) {
  await cp(path.join(editorServicesInstallRoot, 'bin', relativePath), path.join(languageServerTarget, relativePath));
}
await rm(languageServerGemBin, { recursive: true, force: true });
await cp(path.join(editorServicesInstallRoot, 'lib'), path.join(languageServerTarget, 'lib'), { recursive: true });
await cp(path.join(editorServicesInstallRoot, 'LICENSE'), path.join(languageServerTarget, 'LICENSE'));

console.log(`Vendored ${editorServicesGem} ${editorServicesVersion} from ${localGemPath ?? 'RubyGems'}`);
