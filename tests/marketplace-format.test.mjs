import test from 'node:test';
import assert from 'node:assert/strict';
import {formatMoney,formatDate,parseNaira} from '../src/live/marketplace.types.ts';

test('financial displays preserve every kobo and distinguish absent values from zero',()=>{
  assert.equal(formatMoney(123456),'₦1,234.56');
  assert.equal(formatMoney(100010),'₦1,000.10');
  assert.equal(formatMoney(-99),'-₦0.99');
  assert.equal(formatMoney(100000),'₦1,000');
  assert.equal(formatMoney(0),'₦0');
  assert.equal(formatMoney(NaN),'—');
  assert.equal(formatMoney(1.5),'—');
});
test('naira form values convert exactly and reject malformed or over-precise amounts',()=>{
  assert.equal(parseNaira('1234.56'),123456);
  assert.equal(parseNaira(' 0.01 '),1);
  assert.equal(parseNaira('1000.1'),100010);
  for(const invalid of ['', '0', '-1', '1,000', '1.234', '1e6', 'Infinity', 'NaN', '100000000']) assert.equal(parseNaira(invalid),null,invalid);
});
test('missing and invalid receipt dates never crash the page',()=>{
  assert.equal(formatDate(null),'—');
  assert.equal(formatDate('not a date'),'—');
  assert.match(formatDate('2026-10-21T12:00:00Z'),/21/);
});
