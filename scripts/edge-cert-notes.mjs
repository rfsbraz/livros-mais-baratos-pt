#!/usr/bin/env node

/**
 * Builds the Edge Add-ons "notes for certification" for a release: the testing
 * steps in store-listing/edge-certification-notes.txt, then the CHANGELOG.md
 * section for the version, as plain text.
 *
 * Usage:
 *   node scripts/edge-cert-notes.mjs [--version 2.5.0]    prints the notes (dry run)
 *   node scripts/edge-cert-notes.mjs --github-output      also sets the step output "notes"
 *
 * --version defaults to package.json. The script sends nothing and needs no credentials;
 * release.yml passes the output to wdzeng/edge-addon as notes-for-certification.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { releaseNotes } from './changelog.mjs';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
// Microsoft documents no limit for this field. Keep it short enough for a reviewer to read.
const MAX_LENGTH = 2000;
const MORE = '\n(A lista completa está em CHANGELOG.md no repositório GitHub.)';

function buildNotes({ changelog, version, template }) {
  const head = `${template.trim()}\n\nAlterações na versão ${version}:\n`;
  const changes = releaseNotes(changelog, version);
  if (head.length + changes.length <= MAX_LENGTH) {
    return head + changes;
  }
  const kept = [];
  let length = head.length + MORE.length;
  for (const line of changes.split('\n')) {
    if (length + line.length + 1 > MAX_LENGTH) {
      break;
    }
    kept.push(line);
    length += line.length + 1;
  }
  return head + kept.join('\n').trim() + MORE;
}

/** Appends a multiline step output with a random delimiter the value cannot contain. */
function githubOutput(file, name, value) {
  let delimiter;
  do {
    delimiter = `EOF_${crypto.randomBytes(8).toString('hex')}`;
  } while (value.includes(delimiter));
  fs.appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

function main(argv) {
  let version = null;
  let root = ROOT_DIR;
  let toOutput = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version') {
      version = argv[++i];
    } else if (argv[i] === '--root') {
      root = path.resolve(argv[++i]);
    } else if (argv[i] === '--github-output') {
      toOutput = true;
    } else {
      throw new Error(`Unknown argument: ${argv[i]}`);
    }
  }
  version = version || JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  const notes = buildNotes({
    changelog: fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'),
    version,
    template: fs.existsSync(path.join(root, 'store-listing/edge-certification-notes.txt'))
      ? fs.readFileSync(path.join(root, 'store-listing/edge-certification-notes.txt'), 'utf8')
      : 'Não exige conta. Compara o mesmo ISBN nas lojas selecionadas; abre Definições para portes e avisos. O acesso às lojas pode variar. Apoio: rfsbraz@proton.me.'
  });
  console.log(notes);
  console.log(`\n(${notes.length} characters)`);
  if (toOutput) {
    if (!process.env.GITHUB_OUTPUT) {
      throw new Error('--github-output needs GITHUB_OUTPUT');
    }
    githubOutput(process.env.GITHUB_OUTPUT, 'notes', notes);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(`::error title=Edge notes::${error.message}`);
    process.exit(1);
  }
}

export { buildNotes, githubOutput, MAX_LENGTH };
