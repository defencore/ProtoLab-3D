import assert from 'node:assert/strict';
import test from 'node:test';
import { copyText } from '../src/core/clipboard';

function browser(clipboard: unknown, copyResult = true) {
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalRange = {};
  const state = { copied: '', created: 0, removed: 0, focused: 0, ranges: [originalRange] };
  let field: {
    value: string;
    start: number;
    end: number;
    style: Record<string, string>;
    select(): void;
    setSelectionRange(start: number, end: number): void;
    remove(): void;
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard } });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      activeElement: { isConnected: true, focus: () => state.focused++ },
      getSelection: () => ({
        rangeCount: state.ranges.length,
        getRangeAt: (index: number) => state.ranges[index],
        removeAllRanges: () => {
          state.ranges = [];
        },
        addRange: (range: object) => state.ranges.push(range),
      }),
      createElement: () => {
        state.created++;
        field = {
          value: '',
          start: 0,
          end: 0,
          style: {},
          select() {},
          setSelectionRange(start: number, end: number) {
            this.start = start;
            this.end = end;
          },
          remove: () => state.removed++,
        };
        return field;
      },
      body: { appendChild() {} },
      execCommand: (command: string) => {
        assert.equal(command, 'copy');
        state.copied = field.value.slice(field.start, field.end);
        return copyResult;
      },
    },
  });
  return {
    state,
    originalRange,
    restore() {
      for (const [key, descriptor] of [
        ['navigator', previousNavigator],
        ['document', previousDocument],
      ] as const) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test('copying uses the exact qualified library ID through the browser clipboard', async () => {
  let copied = '';
  const context = browser({
    writeText: async (text: string) => {
      copied = text;
    },
  });
  try {
    await copyText('ball-screw:SFK602 / SFK0602 · listing');
    assert.equal(copied, 'ball-screw:SFK602 / SFK0602 · listing');
    assert.equal(context.state.created, 0);
  } finally {
    context.restore();
  }
});

test('copying also works on local HTTP pages and when clipboard permission is denied', async () => {
  for (const clipboard of [
    undefined,
    {
      writeText: async () => {
        throw new Error('Denied');
      },
    },
  ]) {
    const context = browser(clipboard);
    try {
      await copyText('servo-motor:model-12v');
      assert.equal(context.state.copied, 'servo-motor:model-12v');
      assert.equal(context.state.removed, 1);
      assert.equal(context.state.focused, 1);
      assert.deepEqual(context.state.ranges, [context.originalRange]);
    } finally {
      context.restore();
    }
  }
});

test('a failed copy reports failure and still cleans up the temporary selection', async () => {
  const context = browser(undefined, false);
  try {
    await assert.rejects(copyText('fixture:variant'), /could not copy/);
    assert.equal(context.state.removed, 1);
    assert.equal(context.state.focused, 1);
    assert.deepEqual(context.state.ranges, [context.originalRange]);
  } finally {
    context.restore();
  }
});
