const test = require('node:test');
const assert = require('node:assert/strict');
const { validateInventoryProofs } = require('./inventoryProofValidation');
const doc = { originalname: 'receipt.pdf', size: 100 };
const img = { originalname: 'photo.png', size: 100 };
test('requires exactly one document and one image', () => {
  assert.equal(validateInventoryProofs([doc, img]), '');
  for (const files of [[], [doc], [img, img], [doc, doc], [doc, img, img]]) {
    assert.notEqual(validateInventoryProofs(files), '');
  }
});
test('validates retained URLs and rejects oversize or unsupported uploads', () => {
  assert.equal(validateInventoryProofs(['/api/inventory/proof-file/123/receipt.pdf', 'https://example.com/photo.png']), '');
  assert.notEqual(validateInventoryProofs([doc, { ...img, size: 15 * 1024 * 1024 + 1 }]), '');
  assert.notEqual(validateInventoryProofs([doc, { originalname: 'video.mp4' }]), '');
});
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
function controller(name, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '../controllers/inventoryController.js'), 'utf8');
  const start = source.indexOf(`const ${name} =`);
  const end = source.indexOf('\n};', start) + 3;
  return vm.runInNewContext(`${source.slice(start, end)}; ${name}`, {
    console: { log() {}, error() {} }, validateInventoryProofs,
    validateInventoryData: body => ({ errors: [], data: body }),
    getInventoryRoleAccessError: () => '', normalizeString: value => String(value || ''),
    normalizeStringArrayInput: value => value || [],
    ReliefRelease: { exists: async () => false },
    createLog: async () => {}, notifyInventoryRiskState: async () => {},
    attachInventoryEditLockMeta: item => item,
    ...dependencies,
  });
}
function response() { return { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } }; }
test('create rejects invalid proofs before uploading or saving', async () => {
  let uploaded = false;
  const add = controller('addInventory', { uploadInventoryProofFiles: async () => { uploaded = true; } });
  const res = response();
  await add({ body: { type: 'goods' }, files: [doc, img, img] }, res);
  assert.equal(res.code, 400);
  assert.equal(uploaded, false);
});
test('update counts retained proofs and accepts replacing only the image', async () => {
  let saved = false;
  let uploads = 0;
  const item = { _id: 'item', type: 'goods', proofFiles: ['receipt.pdf', 'photo.png'], save: async () => { saved = true; } };
  const update = controller('updateInventory', {
    InventoryItem: { findById: async () => item },
    uploadInventoryProofFiles: async files => { uploads++; return files.map(file => file.originalname); },
  });
  const res = response();
  await update({ params: { id: 'item' }, body: {}, files: [img] }, res);
  assert.equal(res.code, 400);
  assert.equal(saved, false);
  assert.equal(uploads, 0);
  const replacement = response();
  await update({ params: { id: 'item' }, body: { syncProofFiles: 'true', retainedProofFiles: ['receipt.pdf'] }, files: [{ ...img, originalname: 'new.png' }] }, replacement);
  assert.equal(replacement.code, 200);
  assert.equal(saved, true);
  assert.deepEqual(Array.from(item.proofFiles), ['receipt.pdf', 'new.png']);
});
