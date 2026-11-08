const test = require('node:test');
const assert = require('node:assert/strict');
const { createController } = require('../media/expand-thinking');
const { collapsible, documentFor } = require('./dom');

function setup(children) {
  const body = collapsible({ classes: 'host', action: 'Host', open: true, children });
  body.className = 'body';
  delete body.attrs['data-open'];
  const doc = documentFor(body);
  let clock = 0;
  const controller = createController(doc, { now: () => clock, cooldownMs: 400 });
  return {
    body,
    controller,
    advance(ms) { clock += ms; },
  };
}

function headerOf(root) {
  return root.querySelector(':scope > [data-component="collapsible-header"]');
}

test('opens a closed thinking row and leaves an open one alone', () => {
  const closed = collapsible({ classes: 'ui-thinking-collapsible', action: 'Plan the edit', open: false });
  const opened = collapsible({ classes: 'ui-thinking-collapsible', action: 'Thinking', open: true });
  const { controller } = setup([closed, opened]);

  assert.equal(controller.expandAll(), 1);
  assert.equal(headerOf(closed).clicked, 1);
  assert.equal(headerOf(opened).clicked, 0);
});

test('opens Thinking and Thought activity groups and skips other groups', () => {
  const thinking = collapsible({ classes: 'ui-step-group-collapsible', action: 'Thinking', open: false });
  const thought = collapsible({ classes: 'ui-step-group-collapsible', action: 'Thought', open: false });
  const explored = collapsible({ classes: 'ui-step-group-collapsible', action: 'Explored', open: false });
  const { controller } = setup([thinking, thought, explored]);

  assert.equal(controller.expandAll(), 2);
  assert.equal(headerOf(thinking).clicked, 1);
  assert.equal(headerOf(thought).clicked, 1);
  assert.equal(headerOf(explored).clicked, 0);
});

test('opens a closed parent group before its nested thinking row', () => {
  const inner = collapsible({ classes: 'ui-thinking-collapsible', action: 'Thought', open: false });
  const group = collapsible({
    classes: 'ui-step-group-collapsible agent-transcript-activity-group-collapsible',
    action: 'Thinking',
    open: false,
    children: [inner],
  });
  const { controller } = setup([group]);
  const order = [];
  headerOf(group).click = () => order.push('group');
  headerOf(inner).click = () => order.push('inner');

  controller.expandAll();
  assert.deepEqual(order, ['group', 'inner']);
});

test('does not click a row with no open or closed attribute', () => {
  const row = collapsible({ classes: 'ui-thinking-collapsible', action: 'Thinking', open: false });
  delete row.attrs['data-closed'];
  const { controller } = setup([row]);

  assert.equal(controller.expandAll(), 0);
  assert.equal(headerOf(row).clicked, 0);
});

test('respects a manual collapse until the user opens that same row', () => {
  const row = collapsible({ classes: 'ui-thinking-collapsible', action: 'Thought', open: true });
  const { controller } = setup([row]);
  const header = headerOf(row);

  controller.onPointerDown({ target: header.querySelector('.ui-collapsible-action') });
  row.removeAttribute('data-open');
  row.setAttribute('data-closed', '');

  assert.equal(controller.expandAll(), 0);
  assert.equal(header.clicked, 0);

  controller.onPointerDown({ target: header });
  assert.equal(controller.expandAll(), 1);
  assert.equal(header.clicked, 1);
});

test('opens a closed Thinking button that is not marked with the thinking class', () => {
  const { FakeNode, documentFor } = require('./dom');
  const button = new FakeNode({ tag: 'BUTTON', class: 'row', 'aria-expanded': 'false' }, ['Thinking']);
  button.click = function () { this.clicked += 1; };
  const body = new FakeNode({ class: 'body' }, [button]);
  const doc = documentFor(body);
  const controller = createController(doc, { now: () => 1000, cooldownMs: 400 });

  assert.equal(controller.expandAll(), 1);
  assert.equal(button.clicked, 1);
  assert.equal(controller.expandAll(), 0);
});

test('does not toggle a row that is still closed after a recent click', () => {
  const row = collapsible({ classes: 'ui-thinking-collapsible', action: 'Thinking', open: false });
  const { controller, advance } = setup([row]);

  assert.equal(controller.expandAll(), 1);
  assert.equal(controller.expandAll(), 0);
  advance(400);
  assert.equal(controller.expandAll(), 1);
  assert.equal(headerOf(row).clicked, 2);
});
