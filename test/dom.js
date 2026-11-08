class FakeNode {
  constructor(attrs = {}, children = []) {
    this.attrs = { ...attrs };
    this.className = attrs.class || '';
    this.tagName = attrs.tag || 'DIV';
    this.children = [];
    this.parent = null;
    this.clicked = 0;
    this.isText = false;
    this.text = '';
    for (const child of children) this.append(child);
  }

  append(child) {
    let node = child;
    if (typeof child === 'string') {
      node = new FakeNode();
      node.isText = true;
      node.text = child;
    }
    node.parent = this;
    this.children.push(node);
    return node;
  }

  get classList() {
    const classes = this.className.split(/\s+/).filter(Boolean);
    return { contains: (name) => classes.includes(name) };
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attrs, name);
  }

  getAttribute(name) {
    return this.hasAttribute(name) ? String(this.attrs[name]) : null;
  }

  setAttribute(name, value) {
    this.attrs[name] = value;
  }

  removeAttribute(name) {
    delete this.attrs[name];
  }

  get textContent() {
    if (this.isText) return this.text;
    return this.children.map((child) => child.textContent).join('');
  }

  click() {
    this.clicked += 1;
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (!current.isText && matches(current, selector)) return current;
      current = current.parent;
    }
    return null;
  }

  matches(selector) {
    return selector.split(',').some((part) => matches(this, part.trim()));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    if (selector.includes(':scope')) {
      const inner = selector.replace(/^:scope\s*>\s*/, '');
      return this.children.filter((child) => !child.isText && matches(child, inner));
    }
    const selectors = selector.split(',').map((part) => part.trim());
    const out = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.isText) continue;
        if (selectors.some((part) => matches(child, part))) out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }
}

function matches(node, selector) {
  if (selector === 'button') return node.tagName === 'BUTTON';
  if (selector.startsWith('.')) {
    return node.classList.contains(selector.slice(1));
  }
  const attr = selector.match(/^\[([^\]=]+)(?:="([^"]*)")?\]$/);
  if (!attr) return false;
  if (attr[2] === undefined) return node.hasAttribute(attr[1]);
  return node.getAttribute(attr[1]) === attr[2];
}

function collapsible({ classes, action, open, children = [] }) {
  const header = new FakeNode({ 'data-component': 'collapsible-header' }, [
    new FakeNode({ class: 'ui-collapsible-action' }, [action]),
    new FakeNode({ class: 'ui-collapsible-details' }, ['2s']),
  ]);
  const attrs = { class: `ui-collapsible ${classes}` };
  attrs[open ? 'data-open' : 'data-closed'] = '';
  return new FakeNode(attrs, [header, ...children]);
}

function documentFor(body) {
  return {
    body,
    documentElement: new FakeNode(),
    defaultView: {},
    addEventListener() {},
  };
}

module.exports = { FakeNode, collapsible, documentFor };
