import { createElement, Fragment, type ComponentType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseExpression } from '@babel/parser';
import type { Node } from '@babel/types';
import { isSafeLink } from '../shared/links.ts';
import { wrapDeviceComponent } from './mobile-safe-area.ts';

type Registry = Record<string, Record<string, ComponentType<any>>>;
let registry: Promise<Registry> | undefined;
function starters() {
  return registry ??= import(new URL('../dist/starters.mjs', import.meta.url).href).then(module => module.families as Registry).catch(error => {
    registry = undefined;
    throw new Error(`Packaged JSX starters are unavailable. Rebuild the plugin: ${error.message}`);
  });
}

const tags = new Set('a abbr article aside b blockquote br button caption circle code col colgroup dd defs del details div dl dt ellipse em fieldset figcaption figure footer g h1 h2 h3 h4 h5 h6 header hr i image img input label legend li line linearGradient main mark mask nav ol optgroup option p path pattern polygon polyline pre progress radialGradient rect s section select small source span stop strong sub summary sup svg table tbody td text textarea th thead time title tr tspan u ul video clipPath'.split(' '));
const forbidden = new Set(['__proto__', 'prototype', 'constructor', 'dangerouslySetInnerHTML', 'ref', 'srcDoc', 'srcSet', 'action', 'formAction']);

export async function renderJsx(source: string, deviceChrome: 'safe-area' | 'device') {
  const families = await starters(), components = new Map<string, ComponentType<any>>(), owners = new Map<string, string>();
  for (const [family, exports] of Object.entries(families)) for (const [name, component] of Object.entries(exports)) {
    components.set(name, wrapDeviceComponent(name, component, deviceChrome)); owners.set(name, family);
  }
  const used = new Set<string>(), usedComponents = new Set<string>();
  let count = 0;
  const invalid = (message: string): never => { throw Object.assign(new Error(message), { code: 'invalid_jsx' }); };
  function read(node: Node, depth = 0): any {
    if (++count > 5000 || depth > 64) return invalid('JSX exceeds the 5,000-value or 64-level limit. Split it into smaller source components.');
    const next = (child: Node) => read(child, depth + 1);
    switch (node.type) {
      case 'StringLiteral': case 'BooleanLiteral': return node.value;
      case 'NumericLiteral': return Number.isFinite(node.value) && Math.abs(node.value) <= 1e9 ? node.value : invalid('Use a finite numeric literal.');
      case 'NullLiteral': return null;
      case 'UnaryExpression': return node.operator === '-' && node.argument.type === 'NumericLiteral' ? -next(node.argument) : invalid('Only negative numeric literals are supported.');
      case 'TemplateLiteral': return !node.expressions.length ? node.quasis.map(value => value.value.cooked ?? value.value.raw).join('') : invalid('Template interpolation is unavailable. Use literal text and CSS variables.');
      case 'ArrayExpression': return node.elements.map(child => child ? next(child) : null);
      case 'ObjectExpression': {
        const value: Record<string, unknown> = Object.create(null);
        for (const prop of node.properties) {
          if (prop.type !== 'ObjectProperty' || prop.computed || prop.shorthand) return invalid('Use explicit literal object properties, without spreads, methods or computed keys.');
          const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.type === 'StringLiteral' ? prop.key.value : invalid('Use literal object keys.');
          if (forbidden.has(key)) return invalid(`Property ${key} is unavailable.`);
          value[key] = next(prop.value);
        }
        return value;
      }
      case 'JSXFragment': return createElement(Fragment, null, ...node.children.map(next));
      case 'JSXText': {
        const lines = node.value.split(/\r\n|\n|\r/);
        let lastText = 0;
        lines.forEach((line, index) => { if (/[^ \t]/.test(line)) lastText = index; });
        return lines.map((line, index) => {
          let text = line.replaceAll('\t', ' ');
          if (index > 0) text = text.replace(/^ +/, '');
          if (index < lines.length - 1) text = text.replace(/ +$/, '');
          return text && index !== lastText ? text + ' ' : text;
        }).join('');
      }
      case 'JSXExpressionContainer': return node.expression.type === 'JSXEmptyExpression' ? null : next(node.expression);
      case 'JSXElement': {
        const opening = node.openingElement;
        if (opening.name.type !== 'JSXIdentifier') return invalid('Use a native tag or a named packaged component. Namespaced/member tags are unavailable.');
        const name = opening.name.name, component = components.get(name);
        if (!component && !tags.has(name)) return invalid(`Unsupported component ${name}. Read canvas_get_design_guidance for available starters; script/runtime elements are unavailable.`);
        const props: Record<string, any> = {};
        for (const attr of opening.attributes) {
          if (attr.type !== 'JSXAttribute' || attr.name.type !== 'JSXIdentifier') return invalid('Spread and namespaced attributes are unavailable.');
          const key = attr.name.name;
          if (forbidden.has(key) || /^on/i.test(key)) return invalid(`Attribute ${key} is unavailable. JSX is static markup, with no event handlers or injected HTML.`);
          const value = attr.value ? next(attr.value) : true;
          if (key === 'style' && (!value || typeof value !== 'object' || Array.isArray(value))) return invalid('Style must be a literal object.');
          if (key === 'style') for (const part of Object.values(value)) if (!['string', 'number'].includes(typeof part) || /url\s*\(|@import|expression\s*\(/i.test(String(part))) return invalid('Use literal CSS values without resource URLs or expressions.');
          if (['src', 'poster'].includes(key) || (key === 'href' && name !== 'a')) {
            if (typeof value !== 'string' || !/^data:image\/(?:png|jpeg|webp|gif|svg\+xml)[;,]/i.test(value)) return invalid('Embedded image sources must be image data URLs. Prefer separate durable image/video canvas nodes for media.');
          }
          if (key === 'href' && name === 'a' && (typeof value !== 'string' || !isSafeLink(value))) return invalid('Use a safe HTTP(S), mailto, tel or fragment link.');
          props[key] = value;
        }
        if (component) { used.add(owners.get(name)!); usedComponents.add(name); }
        const childNodes = node.children.filter(child => child.type !== 'JSXExpressionContainer' || child.expression.type !== 'JSXEmptyExpression');
        const children = childNodes.map(next).filter((value, index) => childNodes[index].type !== 'JSXText' || value !== '') as ReactNode[];
        return createElement(component ?? name, props, ...(children.length ? children : props.children === undefined ? [] : [props.children]));
      }
      default: return invalid(`Unsupported JSX expression ${node.type}. Imports, identifiers, calls, functions and application JavaScript are not executed. Use literal markup or native canvas nodes.`);
    }
  }
  let tree: ReactNode;
  try { tree = read(parseExpression(source, { plugins: ['jsx'] })); }
  catch (error) { return invalid(error instanceof Error ? error.message : 'Invalid JSX markup.'); }
  const html = renderToStaticMarkup(tree);
  if (html.length > 500_000) return invalid('Rendered HTML exceeds 500,000 characters. Split the design into smaller components.');
  return { html, starters: [...used], components: [...usedComponents] };
}

