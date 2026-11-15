// Exercise the real chat handler with deterministic providers; no database or paid calls.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const img = { mime: 'image/jpeg', data: 'YWJj' };
const garment = (category, description) => ({ category, description, color: 'blue', price_usd: 20, price_is_estimate: true });
const state = globalThis.gemiRouteTest = {
  user: { id: '1', username: 'fixture' },
  current: null,
  shopping: null,
  intent: { tool: 'steal_look', instruction: 'keep my hat' },
  extractions: [], generated: [], saved: [],
  query: async (sql, params) => {
    if (sql.includes('FROM looks WHERE id')) {
      assert.equal(params[1], '1');
      return { rows: state.current ? [{ image: Buffer.from(img.data, 'base64'), image_mime: img.mime, garments: state.current }] : [] };
    }
    if (sql.includes('FROM jobs')) { assert.equal(params[1], '1'); return { rows: state.shopping ? [{ result: { shopping: state.shopping } }] : [] }; }
    if (sql.includes('SELECT preferences')) return { rows: [{ preferences: { gender: 'menswear', size: 'M' } }] };
    return { rows: [] };
  },
};
const mock = (source) => 'data:text/javascript,' + encodeURIComponent('const s = globalThis.gemiRouteTest;\n' + source);
const mocks = {
  '@/lib/auth': mock('export async function currentUser() { return s.user; }'),
  '@/lib/db': mock('export const db = { query: (...args) => s.query(...args) }; export const toVector = JSON.stringify;'),
  '@/lib/jobs': mock('export async function startJob(user, work) { return Response.json(await work(1)); }'),
  '@/lib/job-views': mock('export async function recentTurns() { return ""; }'),
  '@/lib/plans': mock('export async function savePlan(user, plan) { s.planned = plan; return "saved"; } export async function planStatus() { return "not started"; } export async function cancelPlans() { return "cancelled"; }'),
  '@/lib/looks': mock('export async function saveLook(user, image, garments, refs) { s.saved.push({image, garments, refs}); return 123; }'),
  '@/lib/gemini': mock(`
    export async function routeIntent(input) { s.routed = input; return s.intent; }
    export async function extractGarments(input, instruction) { s.extractions.push({ input, instruction }); return s.extractions.length === 1 ? s.products : s.visible; }
    export async function generateTryOn(...args) { s.generated.push(args); return { mime: 'image/png', data: 'eHl6' }; }
    export async function editLook(image, instruction) { s.edited = instruction; return { mime: 'image/png', data: 'eHl6' }; }
    export async function shopGarments(...args) { s.shopped = args; return s.shopping; }
    export const describe = JSON.stringify;
    export const totalUsd = (garments) => garments.reduce((sum, g) => sum + g.price_usd, 0);
    export async function embed() { return [1]; }
    export async function transcribe() { return 'make it black'; }
  `),
};
registerHooks({ resolve(specifier, context, next) {
  if (mocks[specifier]) return { url: mocks[specifier], shortCircuit: true };
  if (specifier.startsWith('@/')) return { url: new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { POST } = await import('../app/api/chat/route.ts');
const post = (body) => POST(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) }));
const reset = () => { state.extractions = []; state.generated = []; state.saved = []; state.products = [garment('top', 'new shirt')]; state.visible = [garment('top', 'new shirt'), garment('bottom', 'original jeans')]; };
reset();
let response = await post({ selfie: img, outfits: [img] });
assert.equal(response.status, 200);
assert.deepEqual(state.generated[0][3], ['top']);
assert.deepEqual(state.saved[0].garments, state.visible);
assert.equal(state.saved[0].refs[0].data, 'eHl6');
reset();
state.products = ['shoes', 'accessory', 'dress', 'top'].map((c) => garment(c, c));
await post({ selfie: img, outfits: [img, img, img, img], text: 'keep my hat' });
assert.equal(state.routed.outfits.length, 4);
assert.equal(state.extractions[0].input.length, 4);
assert.equal(state.generated[0][2].length, 4);
assert.match(state.generated[0][4], /keep my hat/);
reset();
state.intent = { tool: 'micro_edit', instruction: 'swap shorts for trousers' };
state.current = [garment('bottom', 'shorts')];
state.products = [garment('bottom', 'trousers')];
await post({ currentId: 42, text: 'swap shorts for trousers' });
assert.equal(state.saved[0].garments[0].description, 'trousers');
assert.equal(state.extractions[0].input.data, 'eHl6');
reset();
state.intent = { tool: 'shop_and_dress', request: 'blue shirt', categories: ['top'], budget_usd: 30 };
state.shopping = { request: 'blue shirt', categories: ['top'], budget: 30, candidates: [{ garment: garment('top', 'blue shirt') }] };
response = await post({ text: 'find a blue shirt under $30' });
assert.ok((await response.json()).shopping);
assert.equal(state.generated.length, 0, 'search must not generate before confirmation');
assert.match(state.shopped[3], /menswear/);
await post({ currentId: 42, selection: { job: 9, indices: [0] } });
assert.equal(state.generated.length, 1);
assert.equal(state.saved[0].garments.length, 2, 'keep unchanged garments on the receipt');
reset();
state.current = [garment('top', 'old tee'), garment('bottom', 'old jeans'), garment('shoes', 'boots')];
state.shopping = { request: 'dress', categories: ['dress'], candidates: [{ garment: garment('dress', 'floral dress') }] };
await post({ currentId: 42, selection: { job: 9, indices: [0] } });
assert.deepEqual(state.saved[0].garments.map((g) => g.category), ['shoes', 'dress'], 'a dress replaces the top and bottom on the receipt');
state.current = [garment('bottom', 'shorts')];
state.shopping = { request: 'blue shirt', categories: ['top'], budget: 30, candidates: [{ garment: garment('top', 'blue shirt') }] };
assert.equal((await post({ currentId: 42, selection: { job: 9, indices: [999] } })).status, 400);
state.shopping.budget = 1;
assert.equal((await post({ currentId: 42, selection: { job: 9, indices: [0] } })).status, 400);
state.current = null;
state.intent = { tool: 'plan_later', request: 'navy suit', categories: ['outerwear'], run_at: '2030-01-01T09:00:00Z' };
response = await post({ text: 'find me a suit a week before my interview' });
assert.equal((await response.json()).intent.message, 'saved');
assert.equal(state.planned.request, 'navy suit');
assert.equal(state.generated.length, 1, 'a plan must not search or generate now');
state.intent = { tool: 'plan_status' };
assert.equal((await (await post({ text: 'did you start?' })).json()).intent.message, 'not started');
assert.equal((await post({ currentId: 42, text: 'change it' })).status, 404);
state.user = null;
assert.equal((await post({ text: 'hello' })).status, 401);
console.log('ok photo-only scope, four references plus instructions, edited receipts, preview-before-generation, owned selections and budget checks');
