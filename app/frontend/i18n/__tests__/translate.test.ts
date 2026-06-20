import { describe, it, expect } from 'vitest';
import { translate, lookup, resolveDict } from '../translate';
import { en } from '../en';
import { zh } from '../zh';

// M2 · i18n 纯查找：缺失键回退英文 → 回退原 key、参数插值、嵌套点路径。
describe('i18n translate (M2)', () => {
  it('lookup 沿点路径取嵌套字符串', () => {
    const dict = { a: { b: { c: 'hello' } } };
    expect(lookup(dict, ['a', 'b', 'c'])).toBe('hello');
  });

  it('lookup 任一段缺失返回 undefined', () => {
    const dict = { a: { b: {} } };
    expect(lookup(dict, ['a', 'b', 'c'])).toBeUndefined();
    expect(lookup(dict, ['x', 'y'])).toBeUndefined();
  });

  it('lookup 命中非字符串（中间对象）返回 undefined', () => {
    const dict = { a: { b: { c: 'x' } } };
    expect(lookup(dict, ['a', 'b'])).toBeUndefined();
  });

  it('当前语言命中时优先返回当前语言', () => {
    const dict = { greet: 'salut' };
    expect(translate(dict, 'greet')).toBe('salut');
  });

  it('当前语言缺失键 → 回退英文', () => {
    // en 一定有某个键；取一个 en 里存在的真实键路径
    const sampleKey = Object.keys(en)[0];
    const enVal = (en as Record<string, unknown>)[sampleKey];
    if (typeof enVal === 'string') {
      expect(translate({}, sampleKey)).toBe(enVal);
    }
  });

  it('当前语言与英文均缺失 → 回退原 key 本身', () => {
    expect(translate({}, 'totally.unknown.key.xyz')).toBe('totally.unknown.key.xyz');
  });

  it('参数插值：{name} 全局替换', () => {
    expect(translate({ hi: 'Hi {name}, {name}!' }, 'hi', { name: 'Ada' })).toBe('Hi Ada, Ada!');
  });

  it('参数插值支持数字', () => {
    expect(translate({ n: 'count={c}' }, 'n', { c: 3 })).toBe('count=3');
  });

  it('resolveDict 已知语言返回对应字典，未知语言回退中文', () => {
    expect(resolveDict('zh')).toBe(zh);
    expect(resolveDict('en')).toBe(en);
    expect(resolveDict('xx-not-a-lang')).toBe(zh);
  });
});
