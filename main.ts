// Driver for the csv-reader-speed entry: the harness runs `node main.ts`, which reads
// every case from cases.json, answers each one alone with run() from solve.js, and writes
// the answers, one per case and in the cases' order, to answers.json.
//
// Each case is answered on its own: run() keeps nothing from one case to the next, so
// the answers are the same however the cases are ordered, and two runs of this program
// write byte-identical output.
//
// Paths come from MAKEFUN_INPUT_DIR / MAKEFUN_OUTPUT_DIR outside a container, and fall
// back to /input and /output inside one.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all of its work runs
// under it: the house baseline runs with this flag, and an entry may tune V8 the same way.
setFlagsFromString('--no-incremental-marking');

/** solve.js, imported by its URL, typed by the contract it keeps. */
const { run } = (await import(new URL('./solve.js', import.meta.url).href)) as {
  run: (input: unknown) => unknown;
};

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(inputDir, 'cases.json'), 'utf8')) as {
  id: string;
  input: unknown;
}[];

const answers: unknown[] = [];
for (const c of cases) answers.push(run(c.input));

mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'answers.json'), JSON.stringify(answers));
