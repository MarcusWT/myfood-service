import axe from 'axe-core';
import { expect } from 'vitest';

export async function expectNoA11yViolations(container: Element) {
  const res = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(res.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
}
