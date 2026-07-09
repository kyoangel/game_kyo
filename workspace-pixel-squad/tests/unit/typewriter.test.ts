import { describe, it, expect } from 'vitest';
import { visibleChars } from '../../src/ui/typewriter';

describe('visibleChars', () => {
  it('0ms 顯示 0 字', () => expect(visibleChars(0, 30, 10)).toBe(0));
  it('1 秒 30 字', () => expect(visibleChars(1000, 30, 100)).toBe(30));
  it('封頂於總長', () => expect(visibleChars(9999, 30, 10)).toBe(10));
});
