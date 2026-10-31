// Verifies integrity and syntactic validity of multi-flow anchor fixtures
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '..', 'test', 'fixtures', 'multi_flow_anchors');

const files = fs.readdirSync(fixturesDir).filter(f => f.endsWith('.json'));
console.log(`[FIXTURES-VERIFY] Validating ${files.length} anchor fixtures...`);

let valid = 0;
for (const f of files) {
  const raw = fs.readFileSync(path.join(fixturesDir, f), 'utf8');
  const json = JSON.parse(raw);
  if (json.primaryFlow && json.commentaryFlows && json.anchors) {
    valid++;
  }
}
console.log(`[FIXTURES-VERIFY] Successfully validated ${valid}/${files.length} fixtures.`);
