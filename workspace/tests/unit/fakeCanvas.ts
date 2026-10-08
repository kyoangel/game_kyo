export interface Call {
  op: string;
  args: unknown[];
  fillStyle: unknown;
}

/** A canvas whose 2D context records every call (and the fillStyle at that moment). */
export function fakeCanvas(size = 400) {
  const calls: Call[] = [];
  const props: Record<string, unknown> = {};
  const ctx = new Proxy(props, {
    get: (target, prop: string) =>
      prop in target
        ? target[prop]
        : (...args: unknown[]) => {
            calls.push({ op: prop, args, fillStyle: target.fillStyle });
          },
    set: (target, prop: string, value) => {
      target[prop] = value;
      return true;
    },
  });
  const canvas = { width: size, height: size, getContext: () => ctx } as unknown as HTMLCanvasElement;
  return { canvas, ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}
