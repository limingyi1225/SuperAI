#!/usr/bin/env node
// Fail loudly when an environment pins a model id that disagrees with the code
// default. Production keeps its own .env.local (excluded from rsync), so without
// this check a model change in code can silently never reach the live app.
//
//   node --experimental-strip-types scripts/check-model-env.mjs [file...]
//   ssh server "cat /var/www/isabby/.env.local" | node --experimental-strip-types scripts/check-model-env.mjs --label=server -
//
// Exit 1 on any drift. Set ALLOW_MODEL_ENV_DRIFT=1 to downgrade to a warning.

import { readFileSync, existsSync } from 'node:fs';
import { checkModelEnvOverrides, parseEnvFile } from '../lib/modelEnv.ts';

const args = process.argv.slice(2);
const labelArg = args.find(arg => arg.startsWith('--label='));
const label = labelArg ? labelArg.slice('--label='.length) : null;
const sources = args.filter(arg => !arg.startsWith('--'));

if (sources.length === 0) {
    sources.push('.env.local');
}

function readSource(source) {
    if (source === '-') return readFileSync(0, 'utf8');
    if (!existsSync(source)) return null;
    return readFileSync(source, 'utf8');
}

// Empty stdin means the env could not be read at all (e.g. the ssh cat found
// nothing). Reporting that as "ok" would reintroduce exactly the silent pass
// this check exists to prevent, so it is a hard failure.
function isUnreadableStdin(source, contents) {
    return source === '-' && contents.trim() === '';
}

let issueCount = 0;

for (const source of sources) {
    const name = label ?? source;
    const contents = readSource(source);

    if (contents === null) {
        console.log(`  ${name}: not present, code defaults apply — ok`);
        continue;
    }

    if (isUnreadableStdin(source, contents)) {
        issueCount += 1;
        console.error(`  ✖ ${name}: read back empty — the env could not be verified, refusing to assume it is fine`);
        continue;
    }

    const issues = checkModelEnvOverrides(parseEnvFile(contents));

    if (issues.length === 0) {
        console.log(`  ${name}: model overrides agree with the code defaults — ok`);
        continue;
    }

    issueCount += issues.length;
    for (const issue of issues) {
        console.error(`  ✖ ${name}: ${issue.message}`);
        console.error(`      → ${issue.suggestion}`);
    }
}

if (issueCount === 0) process.exit(0);

if (process.env.ALLOW_MODEL_ENV_DRIFT === '1') {
    console.error(`  ⚠️  ${issueCount} model env problem(s); continuing because ALLOW_MODEL_ENV_DRIFT=1`);
    process.exit(0);
}

console.error(`\n  ${issueCount} problem(s): this env would not run the models this checkout declares.`);
console.error('  Fix the env file, or re-run with ALLOW_MODEL_ENV_DRIFT=1 if the override is intentional.');
process.exit(1);
