'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { encode, parse, sync } = require('../scripts/marketplace-sync.cjs');

test('Mi-T-M sync publishes component images even when the CSV is already current', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'wep-mitm-component-images-'));
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const source = path.join(fixture, 'configurator');
  const root = path.join(fixture, 'marketplace');
  const options = {
    brand: 'mitm',
    sourceFile: path.join(source, 'data', 'products.csv'),
    root,
    backupRoot: path.join(fixture, 'backup'),
  };

  function write(parent, relative, contents) {
    const file = path.join(parent, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
  }

  const productHeaders = ['SKU', 'Category', 'Model', 'Series', 'ImageURL'];
  const product = { SKU: 'GEN-2000-IMM1', Category: 'Generators', ImageURL: 'images/generator.jpg' };
  write(source, 'data/products.csv', encode(productHeaders, [product]));
  write(root, 'brands/mitm/data/products.csv', encode(productHeaders, []));
  write(source, 'images/generator.jpg', 'generator image');

  const components = [
    ['attachments', 'ATT-1', 'images/attachment.jpg'],
    ['accessories', '32-0915', 'images/32-0915.jpg'],
    ['parts', 'PART-1', 'brands/mitm/images/part.jpg'],
  ];
  const headers = ['SKU', 'BrandID', 'GEN-2000-IMM1', 'ImageURL'];
  for (const [table, sku, image] of components) {
    write(source, `data/${table}.csv`, encode(headers, [
      { SKU: sku, BrandID: 'MITM', 'GEN-2000-IMM1': 'T', ImageURL: image },
      { SKU: sku + '-BLANK', BrandID: 'MITM', ImageURL: '' },
      { SKU: sku + '-REMOTE', BrandID: 'MITM', ImageURL: 'https://example.com/image.jpg' },
    ]));
    write(source, image.replace(/^brands\/mitm\//, ''), sku + ' image');
  }
  // A previously published link must still get its photo if the file arrives later.
  fs.copyFileSync(path.join(source, 'data', 'parts.csv'), path.join(root, 'brands', 'mitm', 'data', 'parts.csv'));

  const first = sync(options);
  assert.equal(first.imageCount, 4);
  assert.equal(first.buildBuyDataChanges, 2);
  assert.equal(parse(fs.readFileSync(path.join(root, 'brands/mitm/data/products.csv'), 'utf8')).rows[0].ImageURL,
    'brands/mitm/images/generator.jpg');

  for (const [table, sku, image] of components) {
    const csv = parse(fs.readFileSync(path.join(root, `brands/mitm/data/${table}.csv`), 'utf8'));
    const publicImage = 'brands/mitm/' + image.replace(/^brands\/mitm\//, '');
    assert.equal(csv.rows[0].ImageURL, publicImage);
    assert.equal(csv.rows[0]['GEN-2000-IMM1'], 'T');
    assert.equal(csv.rows[1].ImageURL, '');
    assert.equal(csv.rows[2].ImageURL, 'https://example.com/image.jpg');
    assert.equal(fs.readFileSync(path.join(root, publicImage), 'utf8'), sku + ' image');
  }

  const second = sync(options);
  assert.equal(second.changed, false);
  assert.equal(second.imageCount, 0);
  assert.equal(second.buildBuyDataChanges, 0);
});
