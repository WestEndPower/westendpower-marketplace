'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const vm = require('node:vm');

test('accessory cards show item number and description while preserving the cart SKU', () => {
  const source = fs.readFileSync(require.resolve('../universal/product-options.js'), 'utf8');
  const start = source.indexOf('function itemCard(');
  const end = source.indexOf('function powerRank(', start);
  assert.ok(start >= 0 && end > start);
  const render = vm.runInNewContext(source.slice(start, end) + '\nitemCard', {
    clean: value => String(value ?? '').trim(),
    esc: value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    currentPrice: () => 119.99,
    img: () => '',
    packageIncludedSku: () => false,
    fmt: String,
    setupMarkup: () => '',
    stockMarkup: () => '',
    money: Number,
    assemblyAmount: () => 0,
    assemblyCode: () => '',
    quoteEnabled: () => true,
    WEPBuildBuy: { cardInfo: () => '', energySpecs: () => '' },
    buildContext: {},
  });
  const item = { SKU: '32-0915', Model: 'Item-32', Description: 'Hose & fitting' };
  const card = render(item, 'accessory');
  assert.match(card, /<h3>Item-32<\/h3><small>Hose &amp; fitting<\/small>/);
  assert.doesNotMatch(card, /<small>SKU 32-0915<\/small>/);
  assert.match(card, /data-type="accessory" data-sku="32-0915"/);
  assert.match(render({ ...item, Model: '' }, 'accessory'), /<h3>32-0915<\/h3><small>Hose &amp; fitting<\/small>/);
  assert.match(render({ ...item, Description: '' }, 'accessory'), /<h3>Item-32<\/h3><small class="wep-package-included-note"/);
  assert.match(render(item, 'attachment'), /<h3>Item-32<\/h3><small>SKU 32-0915<\/small>/);
});
