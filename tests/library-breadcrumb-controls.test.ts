import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LibraryBreadcrumbs from '../src/components/LibraryBreadcrumbs';
import type { LibraryLocation } from '../src/core/library-navigation';

function render(location: LibraryLocation, label?: string, className?: string): string {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    return renderToStaticMarkup(
      React.createElement(LibraryBreadcrumbs, {
        location,
        onNavigate() {},
        label,
        className,
      }),
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, 'React', previous);
    else Reflect.deleteProperty(globalThis, 'React');
  }
}

test('library breadcrumb ancestors are semantic navigation buttons with readable levels', () => {
  const html = render({
    level: 'subgroup',
    category: 'POWER & MOTOR CONTROL',
    subgroup: 'BATTERIES & HOLDERS',
  });
  assert.match(html, /^<nav class="breadcrumbs library-breadcrumbs" aria-label="Library path">/);
  assert.equal((html.match(/<button type="button"/g) ?? []).length, 3);
  assert.match(html, />Library<\/button>/);
  assert.match(html, />Power &amp; motor control<\/button>/);
  assert.match(html, /class="breadcrumb-current"[^>]*>Batteries &amp; holders<\/button>/);
  assert.equal(
    (html.match(/class="lucide lucide-chevron-right breadcrumb-separator"/g) ?? []).length,
    2,
  );
  assert.equal((html.match(/aria-hidden="true"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /aria-current="page"/);
});

test('library and category paths expose exactly their available levels', () => {
  const root = render({ level: 'all' });
  assert.equal((root.match(/<button /g) ?? []).length, 1);
  assert.doesNotMatch(root, /breadcrumb-separator/);
  const category = render({ level: 'category', category: 'MOTORS & ACTUATORS' });
  assert.equal((category.match(/<button /g) ?? []).length, 2);
  assert.match(category, />Motors &amp; actuators<\/button>/);
});

test('a scoped catalog can reuse the same controls with its own accessible label and style', () => {
  const html = render(
    { level: 'category', category: 'POWER & MOTOR CONTROL' },
    'Library scope',
    'library-scope-path',
  );
  assert.match(html, /class="library-scope-path library-breadcrumbs"/);
  assert.match(html, /aria-label="Library scope"/);
  assert.equal((html.match(/<button /g) ?? []).length, 2);
});

test('each ancestor button requests its own exact inventory level', () => {
  const location: LibraryLocation = {
    level: 'subgroup',
    category: 'POWER & MOTOR CONTROL',
    subgroup: 'BATTERIES & HOLDERS',
  };
  const navigations: LibraryLocation[] = [];
  const clicks: (() => void)[] = [];
  function collect(node: React.ReactNode) {
    if (!React.isValidElement(node)) return;
    const element = node as React.ReactElement<{
      children?: React.ReactNode;
      onClick?: () => void;
    }>;
    if (element.type === 'button') clicks.push(element.props.onClick!);
    React.Children.forEach(element.props.children, collect);
  }
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'React');
  Object.defineProperty(globalThis, 'React', { configurable: true, value: React });
  try {
    collect(LibraryBreadcrumbs({ location, onNavigate: (next) => navigations.push(next) }));
    clicks.forEach((click) => click());
  } finally {
    if (previous) Object.defineProperty(globalThis, 'React', previous);
    else Reflect.deleteProperty(globalThis, 'React');
  }
  assert.deepEqual(navigations, [
    { level: 'all' },
    { level: 'category', category: 'POWER & MOTOR CONTROL' },
    location,
  ]);
});
