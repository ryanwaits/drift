import type { ApiSpec } from '../analysis/api-spec';
import { detectProseDrift } from '../analysis/drift/prose-drift';
import type { ExportRegistry, SpecDocDrift } from '../analysis/drift/types';
import {
  computeKeyCoverage,
  DEFAULT_SECTION_RE,
  extractDocumentedKeys,
  resolveTypeEntries,
} from '../analysis/key-coverage';
import { parseMarkdownFile } from '../markdown/parser';
import type { MarkdownDocFile } from '../markdown/types';
import { detectCallSiteHits } from './call-sites';
import { ambiguousExports, fenceEntry } from './entries';
import {
  blockContaining,
  collectPackageNamespaces,
  extractBareCallees,
  extractExportBindings,
  extractFenceCalls,
  extractFenceImports,
  extractFenceMembers,
  extractLocalNames,
  fenceImportKind,
  isMigrationFence,
  isPackageModule,
  pageLocalNames,
} from './fences';
import {
  attachHeading,
  collectHeadings,
  type FenceBlock,
  fencedLines,
  HEADING,
  headingAncestorNames,
  headingLocator,
  isApiToken,
  isBuiltinName,
  isCallForm,
  isMemberToken,
  locateInFence,
  locateOnLine,
  nearestHeading,
  normalizeApiName,
  type PageHeading,
  pageTitle,
  unwrapApiToken,
} from './locators';
import { findParamDocHits } from './param-docs';
import { findProseHits } from './prose';
import {
  makeSpecRef,
  resolveApiName,
  resolveCall,
  resolveMemberName,
  specRefKey,
  uniqueSlices,
} from './spec-ref';
import type {
  BuildPageDocumentOptions,
  BuildPageDocumentsOptions,
  Claim,
  ClaimKind,
  Locator,
  PageDocsMapPage,
  PageDocument,
  RuleHit,
  SpecRef,
} from './types';

const BACKTICK: RegExp = /`([^`\n]+)`/g;
const KIND_ORDER: Record<ClaimKind, number> = {
  fence: 0,
  'table-key': 1,
  inline: 2,
  heading: 3,
  prose: 4,
  gap: 5,
};

/** One entry of the package (the primary spec, or a secondary) and what the page's imports bind to it. */
type EntryScope = {
  spec: ApiSpec;
  registry: ExportRegistry;
  /** Module specifier whose imports are this entry's. Undefined: no fence selects it. */
  specifier?: string;
  /** `import * as z` aliases of the entry on this page */
  namespaces: Set<string>;
  namedImports: Set<string>;
  /** Renamed / default imports, and the default export's source name: local → export */
  aliases: Map<string, string>;
};

/** The primary entry's bindings, plus every entry when `alsoSpecs` is passed. */
type PageScope = EntryScope & {
  parsed: MarkdownDocFile;
  /** Per fence (by index): names an earlier fence declared, which shadow an export */
  shadowed: Array<ReadonlySet<string>>;
  entries: EntryScope[];
  /** Exports the entries give different signatures */
  ambiguous: ReadonlySet<string>;
};

const scopes = new WeakMap<BuildPageDocumentOptions, PageScope>();
const NONE: ReadonlySet<string> = new Set();

/** Parsed fences and what the page's imports bind, once per page. */
function pageScope(opts: BuildPageDocumentOptions): PageScope {
  let scope = scopes.get(opts);
  if (!scope) {
    const parsed = parseMarkdownFile(opts.content, opts.file);
    const packageName = opts.packageName ?? opts.spec.meta.name;
    const codes = parsed.codeBlocks.map((b) => b.code);
    const secondaries = opts.alsoSpecs ?? [];
    const entries = [opts, ...secondaries].map((entry, i): EntryScope => {
      const specifier = i === 0 ? (opts.importSpecifier ?? packageName) : entry.importSpecifier;
      return {
        spec: entry.spec,
        registry: entry.registry,
        specifier,
        ...(specifier
          ? collectPackageNamespaces(
              codes,
              entry.registry.all,
              packageName,
              specifier,
              entry.registry.localNames,
            )
          : { namespaces: new Set(), namedImports: new Set(), aliases: new Map() }),
      };
    });
    scope = {
      ...entries[0],
      parsed,
      shadowed: pageLocalNames(codes, packageName),
      entries,
      ambiguous: secondaries.length > 0 ? ambiguousExports([opts, ...secondaries]) : NONE,
    };
    scopes.set(opts, scope);
  }
  return scope;
}

/**
 * Entry a fence is written against. A fence that imports no entry is the
 * primary's, minus the names the entries disagree on (`unsure`).
 */
function fenceScope(
  opts: BuildPageDocumentOptions,
  code: string,
): { entry: EntryScope; unsure: ReadonlySet<string>; primary: boolean } {
  const scope = pageScope(opts);
  const at = fenceEntry(code, scope.specifier ?? '', opts.alsoSpecs ?? []);
  return {
    entry: scope.entries[at.index],
    unsure: at.imported ? NONE : scope.ambiguous,
    primary: at.index === 0,
  };
}

function posixPath(file: string): string {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

function pageKey(p: string): string {
  return posixPath(p)
    .replace(/^\//, '')
    .replace(/\.(mdx?|html?)$/i, '');
}

function pageMatches(mapPage: string, file: string): boolean {
  const a = pageKey(mapPage);
  const b = pageKey(file);
  return a === b || b.endsWith(`/${a}`) || a.endsWith(`/${b}`);
}

function mappedPage(opts: BuildPageDocumentOptions): PageDocsMapPage | undefined {
  return opts.docsMap?.pages.find((p) => pageMatches(p.page, opts.file));
}

function claimId(
  path: string,
  kind: ClaimKind,
  specRef: SpecRef | null,
  text: string,
  line: number,
  ruleType?: string,
): string {
  const target = specRefKey(specRef) ?? text;
  return ruleType
    ? `${path}:${kind}:${target}:${ruleType}:${line}`
    : `${path}:${kind}:${target}:${line}`;
}

function toRule(issue: SpecDocDrift): RuleHit {
  return {
    type: issue.type,
    issue: issue.issue,
    ...(issue.suggestion ? { suggestion: issue.suggestion } : {}),
  };
}

function sortClaims(claims: Claim[]): Claim[] {
  return [...claims].sort((a, b) => {
    const ko = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (ko !== 0) return ko;
    if (a.locator.start.line !== b.locator.start.line) {
      return a.locator.start.line - b.locator.start.line;
    }
    return a.locator.start.col - b.locator.start.col;
  });
}

function seenKey(claim: Claim): string {
  return `${claim.kind}:${specRefKey(claim.specRef) ?? claim.text}:${claim.rule?.type ?? ''}:${claim.locator.start.line}`;
}

function pushUnique(claims: Claim[], claim: Claim): void {
  const key = seenKey(claim);
  if (claims.some((c) => seenKey(c) === key || c.id === claim.id)) return;
  claims.push(claim);
}

function fenceLocator(
  path: string,
  content: string,
  block: FenceBlock,
  span: { text: string; line: number; col: number },
  headings: PageHeading[],
): Locator | null {
  const found = locateInFence(content, block, span.text, span.line, span.col);
  return found ? attachHeading({ path, ...found }, headings) : null;
}

function fenceClaims(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  issues: SpecDocDrift[],
): Claim[] {
  const { file, content } = opts;
  const { parsed } = pageScope(opts);
  const claims: Claim[] = [];

  for (const issue of issues) {
    if (issue.filePath && posixPath(issue.filePath) !== posixPath(file)) continue;
    if (
      issue.type !== 'prose-deprecated-reference' &&
      issue.type !== 'prose-unresolved-member' &&
      issue.type !== 'prose-broken-reference'
    ) {
      continue;
    }
    const target = issue.target ?? '';
    // Prose drift reports `block.lineStart + <0-indexed code line>`: the fence
    // line itself for an import, one line above the call for a member.
    const hintLine = issue.line ?? 1;
    const block = blockContaining(parsed.codeBlocks, hintLine);
    if (!block) continue;
    const codeLine = hintLine - block.lineStart;
    const { spec, registry, namespaces } = fenceScope(opts, block.code).entry;

    const named = extractFenceCalls(block.code).filter(
      (c) =>
        c.methodName === target ||
        `${c.objectName}.${c.methodName}` === target ||
        c.objectName === target,
    );
    const call = named.find((c) => c.line === codeLine) ?? named[0];
    const imports = extractFenceImports(block.code);
    const pair = imports.find((i) => i.invalidPair?.pair === target);
    const imp = pair ?? imports.find((i) => i.imported === target);
    const aboutImport = issue.type === 'prose-broken-reference' && !target.includes('.');

    let text = target;
    let specRef: SpecRef | null = null;
    let loc: Locator | null = null;
    if (call && !(aboutImport && imp)) {
      text = call.text;
      // `ns.member` is the export `member`, or nothing: never `ns`'s own member.
      specRef = namespaces.has(call.objectName)
        ? registry.all.has(call.methodName)
          ? makeSpecRef(spec, registry, call.methodName)
          : null
        : resolveCall(spec, registry, call.objectName, call.methodName, issue.owner);
      loc = fenceLocator(file, content, block, call, headings);
    } else if (imp) {
      text = pair?.invalidPair?.text ?? imp.text;
      specRef = resolveApiName(spec, registry, imp.imported);
      loc = fenceLocator(file, content, block, { ...imp, text }, headings);
    } else {
      text = target.includes('.') ? (target.split('.').pop() ?? target) : target;
      loc = fenceLocator(file, content, block, { text, line: codeLine, col: 0 }, headings);
    }
    if (!loc) continue;
    // A member is cited on the type the receiver resolved to, never looked up
    // by bare name. One that type lacks has no spec record: a ghost.
    if (issue.type === 'prose-unresolved-member') specRef = null;
    else if (issue.owner) specRef = makeSpecRef(spec, registry, issue.owner, target);
    else if (!specRef && !target.includes('.')) specRef = resolveApiName(spec, registry, target);

    pushUnique(claims, {
      id: claimId(file, 'fence', specRef, text, loc.start.line),
      kind: 'fence',
      text,
      locator: loc,
      specRef,
      rule: toRule(issue),
      candidate: false,
    });
  }

  return claims;
}

function callSiteClaims(opts: BuildPageDocumentOptions, headings: PageHeading[]): Claim[] {
  const { file, content } = opts;
  const packageName = opts.packageName ?? opts.spec.meta.name;
  const { parsed, shadowed } = pageScope(opts);
  // Bindings are per entry: a `zod/mini` fence never types a `zod` one.
  const bindingsOf = new Map<EntryScope, Map<string, string>>();
  const claims: Claim[] = [];

  for (const [index, block] of parsed.codeBlocks.entries()) {
    const { entry, unsure } = fenceScope(opts, block.code);
    const { spec, registry, namespaces, namedImports, aliases } = entry;
    const bindings = extractExportBindings(block.code, {
      exportNames: registry.all,
      spec,
      prior: bindingsOf.get(entry),
      aliases,
      registry,
      namespaces,
      ambiguous: unsure,
      shadowed: shadowed[index],
    });
    bindingsOf.set(entry, bindings);
    const skip =
      isMigrationFence(content, block.lineStart, block.code) ||
      fenceImportKind(block.code, packageName, entry.specifier) === 'foreign';
    for (const hit of detectCallSiteHits(block.code, spec, registry, bindings, {
      namespaces,
      namedImports,
      aliases,
      ambiguous: unsure,
      shadowed: shadowed[index],
      skip,
    })) {
      const loc = fenceLocator(file, content, block, hit, headings);
      if (!loc) continue;
      const specRef = makeSpecRef(spec, registry, hit.exportName, hit.member);
      pushUnique(claims, {
        id: claimId(file, 'fence', specRef, hit.text, loc.start.line, hit.type),
        kind: 'fence',
        text: hit.text,
        locator: loc,
        specRef,
        rule: {
          type: hit.type,
          issue: hit.issue,
          ...(hit.suggestion ? { suggestion: hit.suggestion } : {}),
        },
        candidate: false,
      });
    }
  }
  return claims;
}

function tableKeyClaims(opts: BuildPageDocumentOptions, headings: PageHeading[]): Claim[] {
  const { spec, registry, file, content } = opts;
  const mapped = mappedPage(opts);
  const sectionRe = mapped?.sectionRe ? new RegExp(mapped.sectionRe) : DEFAULT_SECTION_RE;
  const corpus = extractDocumentedKeys([{ path: file, content }], sectionRe);
  const coverage = mapped
    ? computeKeyCoverage(spec, mapped.type, corpus, {
        internal: mapped.internal,
        deprecated: mapped.deprecated,
        replacements: mapped.replacements,
        annotations: mapped.annotations,
      })
    : null;

  const claims: Claim[] = [];
  const parentType = mapped?.type;

  for (const [key, locs] of corpus.documented) {
    const here = locs.filter((l) => posixPath(l.file) === posixPath(file));
    for (const loc of here) {
      const span = loc.raw || key;
      const found =
        locateOnLine(content, loc.line, `\`${span}\``) ?? locateOnLine(content, loc.line, span);
      if (!found) continue;
      const ghost = coverage?.ghosts.find((g) => g.key === key);
      const inversion = coverage?.inversions.find((i) => i.documented === key);
      const specRef = ghost
        ? null
        : parentType
          ? makeSpecRef(spec, registry, parentType, key)
          : isApiToken(span)
            ? resolveApiName(spec, registry, key, undefined, pageScope(opts).namespaces)
            : null;
      let rule: RuleHit | undefined;
      if (ghost) {
        rule = {
          type: 'key-ghost',
          issue: `Documented key '${key}' is not on any spec type`,
        };
      } else if (inversion) {
        rule = {
          type: 'key-inversion',
          issue: `Documented deprecated key '${inversion.documented}' but replacement '${inversion.replacement}' is missing`,
          suggestion: `Document '${inversion.replacement}'`,
        };
      }
      const locator = attachHeading({ path: file, start: found.start, end: found.end }, headings);
      pushUnique(claims, {
        id: claimId(file, 'table-key', specRef, key, locator.start.line),
        kind: 'table-key',
        text: span,
        locator,
        specRef,
        ...(rule ? { rule } : {}),
        candidate: false,
      });
    }
  }

  const sectionHeading = headings.find((h) => sectionRe.test(h.text));
  // Mapped pages without an options table are method/type references —
  // spec-not-in-claims covers missing members. Don't treat every member as a key-gap.
  if (coverage && parentType && (sectionHeading || corpus.documented.size > 0)) {
    const anchor = sectionHeading ?? headings[0];
    for (const gap of coverage.gaps.userFacing) {
      const specRef = makeSpecRef(spec, registry, parentType, gap.key);
      const locator = anchor
        ? headingLocator(file, anchor)
        : attachHeading(
            { path: file, start: { line: 1, col: 1 }, end: { line: 1, col: 1 } },
            headings,
          );
      pushUnique(claims, {
        id: claimId(file, 'gap', specRef, gap.key, locator.start.line),
        kind: 'gap',
        text: gap.key,
        locator,
        specRef,
        rule: {
          type: 'key-gap',
          issue: `Spec key '${parentType}.${gap.key}' is not documented on this page`,
          ...(gap.description ? { suggestion: gap.description } : {}),
        },
        candidate: false,
      });
    }
  }

  return claims;
}

/** Parameter tables / `## Parameters` lists against the heading export's signatures. */
function paramDocClaims(opts: BuildPageDocumentOptions, headings: PageHeading[]): Claim[] {
  const { spec, registry, file, content } = opts;
  const claims: Claim[] = [];
  for (const hit of findParamDocHits(content, spec, registry, headings)) {
    const found = locateOnLine(content, hit.line, hit.span);
    if (!found) continue;
    const [exportName, member] = hit.exportName.split('.');
    const specRef = makeSpecRef(spec, registry, exportName, member);
    const locator = attachHeading({ path: file, ...found }, headings);
    pushUnique(claims, {
      id: claimId(file, 'table-key', specRef, hit.text, locator.start.line, hit.type),
      kind: 'table-key',
      text: hit.text,
      locator,
      specRef,
      rule: {
        type: hit.type,
        issue: hit.issue,
        ...(hit.suggestion ? { suggestion: hit.suggestion } : {}),
      },
      candidate: false,
    });
  }
  return claims;
}

function inlineClaims(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  existing: Claim[],
): Claim[] {
  const { spec, registry, file, content } = opts;
  const claims: Claim[] = [];
  const lines = content.split('\n');
  const fenced = fencedLines(lines);
  const headingLines = new Set(headings.map((h) => h.line));
  const { namespaces } = pageScope(opts);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fenced[i]) continue;
    if (HEADING.test(line)) continue;
    const lineNo = i + 1;
    if (headingLines.has(lineNo)) continue;

    for (const m of line.matchAll(BACKTICK)) {
      const raw = m[1];
      const name = unwrapApiToken(raw);
      const preferred = ancestorPreferred(registry, headings, lineNo);
      if (!isApiToken(raw)) continue;
      let specRef = isMemberToken(raw)
        ? resolveMemberName(spec, registry, name, preferred)
        : resolveApiName(spec, registry, name, preferred, namespaces);
      if (!specRef && preferred) {
        for (const parent of preferred) {
          if (listedMembers(spec, parent).includes(name)) {
            specRef = makeSpecRef(spec, registry, parent, name);
            break;
          }
        }
      }
      if (!specRef) continue;
      const already = existing.some(
        (c) =>
          c.locator.start.line === lineNo &&
          (c.text === raw || specRefKey(c.specRef) === specRefKey(specRef)),
      );
      if (already) continue;
      const token = `\`${raw}\``;
      const found = locateOnLine(content, lineNo, token) ?? locateOnLine(content, lineNo, raw);
      if (!found) continue;
      const locator = attachHeading({ path: file, start: found.start, end: found.end }, headings);
      pushUnique(claims, {
        id: claimId(file, 'inline', specRef, raw, locator.start.line),
        kind: 'inline',
        text: raw,
        locator,
        specRef,
        candidate: true,
      });
    }
  }

  // Fence mentions: one per (fence, export), on the referencing token inside
  // that fence. The first call, else the import. A renamed or default import
  // is its export; a name the fence declares, an earlier fence declared, or
  // the fence imports from elsewhere, is not.
  const { parsed, shadowed } = pageScope(opts);
  const packageName = opts.packageName ?? spec.meta.name;
  for (const [index, block] of parsed.codeBlocks.entries()) {
    // A fence that imports a secondary entry mentions that entry's exports.
    const { spec, registry, aliases } = fenceScope(opts, block.code).entry;
    const imports = extractFenceImports(block.code);
    const foreign = new Set(
      imports.filter((i) => !isPackageModule(i.from, packageName)).map((i) => i.name),
    );
    const locals = new Set([...extractLocalNames(block.code), ...shadowed[index]]);
    const mentions: Array<{ exportName: string; text: string; line: number; col: number }> = [];
    for (const callee of extractBareCallees(block.code)) {
      if (locals.has(callee.name) || foreign.has(callee.name)) continue;
      const exportName = aliases.get(callee.name) ?? callee.name;
      mentions.push({ exportName, text: callee.name, line: callee.line, col: callee.col });
    }
    for (const imp of imports) {
      if (imp.kind !== 'named' || foreign.has(imp.name)) continue;
      mentions.push({ exportName: imp.imported, text: imp.text, line: imp.line, col: imp.col });
    }

    const seen = new Set<string>();
    for (const m of mentions) {
      if (!registry.all.has(m.exportName) || seen.has(m.exportName)) continue;
      seen.add(m.exportName);
      const specRef = makeSpecRef(spec, registry, m.exportName);
      const already = existing
        .concat(claims)
        .some(
          (c) =>
            specRefKey(c.specRef) === specRefKey(specRef) &&
            c.locator.start.line > block.lineStart &&
            c.locator.start.line <= block.lineEnd,
        );
      if (already) continue;
      const locator = fenceLocator(file, content, block, m, headings);
      if (!locator) continue;
      pushUnique(claims, {
        id: claimId(file, 'inline', specRef, m.text, locator.start.line),
        kind: 'inline',
        text: m.text,
        locator,
        specRef,
        candidate: true,
      });
    }
  }

  return claims;
}

function headingClaims(opts: BuildPageDocumentOptions, headings: PageHeading[]): Claim[] {
  const { spec, registry, file } = opts;
  const claims: Claim[] = [];
  for (const heading of headings) {
    const name = normalizeApiName(heading.text);
    // `## number` is a word; `` ## `number` `` and `## number()` are the API.
    if (isBuiltinName(name) && !heading.code && !isCallForm(heading.text)) continue;
    const specRef = resolveApiName(
      spec,
      registry,
      name,
      ancestorPreferred(registry, headings, heading.line),
      pageScope(opts).namespaces,
    );
    if (!specRef) continue;
    const locator = headingLocator(file, heading);
    pushUnique(claims, {
      id: claimId(file, 'heading', specRef, heading.text, locator.start.line),
      kind: 'heading',
      text: heading.text,
      locator,
      specRef,
      candidate: true,
    });
  }
  return claims;
}

function ancestorPreferred(
  registry: ExportRegistry,
  headings: PageHeading[],
  line: number,
): Set<string> | undefined {
  const preferred = new Set<string>();
  for (const name of headingAncestorNames(headings, line)) {
    if (registry.all.has(name) || registry.typeNames.includes(name)) preferred.add(name);
  }
  return preferred.size > 0 ? preferred : undefined;
}

function joinTypes(opts: BuildPageDocumentOptions, claims: Claim[]): Set<string> {
  const types = new Set<string>();
  const mapped = mappedPage(opts);
  if (mapped) types.add(mapped.type);
  // Stronger than a mention: the page's own heading names the type or a member.
  // Inline/fence citations stay inventory (candidate), never join a gap dump.
  for (const c of claims) {
    if (c.kind !== 'heading' || !c.specRef) continue;
    if (c.specRef.member) {
      types.add(c.specRef.export);
      continue;
    }
    if (listedMembers(opts.spec, c.specRef.export).length > 0) {
      types.add(c.specRef.export);
    }
  }
  return types;
}

function isPrivateMember(name: string, visibility: string | undefined): boolean {
  if (name.startsWith('_')) return true;
  return visibility === 'private' || visibility === 'protected';
}

/** Public members for spec-not-in-claims. Schema properties are key-coverage, not this. */
function listedMembers(
  spec: BuildPageDocumentOptions['spec'],
  typeName: string,
  skip: ReadonlySet<string> = new Set(),
): string[] {
  const names = new Set<string>();
  for (const entry of resolveTypeEntries(spec, typeName)) {
    for (const member of entry.members ?? []) {
      if (!member.name) continue;
      if (isPrivateMember(member.name, member.visibility)) continue;
      if (skip.has(member.name)) continue;
      names.add(member.name);
    }
  }
  return [...names];
}

function mentionedMembers(
  opts: BuildPageDocumentOptions,
  typeName: string,
  claims: Claim[],
  headings: PageHeading[],
): Set<string> {
  const mentioned = new Set<string>();
  for (const c of claims) {
    if (c.specRef?.export === typeName && c.specRef.member) mentioned.add(c.specRef.member);
  }
  const escaped = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const qualified = new RegExp(`${escaped}\\.([A-Za-z_$][\\w$]*)`, 'g');
  for (const m of opts.content.matchAll(qualified)) mentioned.add(m[1]);

  const { parsed } = pageScope(opts);
  let bindings = new Map<string, string>();
  const members = new Set(listedMembers(opts.spec, typeName));
  for (const block of parsed.codeBlocks) {
    bindings = extractExportBindings(block.code, {
      exportNames: opts.registry.all,
      spec: opts.spec,
      prior: bindings,
      registry: opts.registry,
    });
    const inTypeSection = headingAncestorNames(headings, block.lineStart + 1).includes(typeName);
    for (const mention of extractFenceMembers(block.code)) {
      if (members.size > 0 && !members.has(mention.memberName)) continue;
      const bound = bindings.get(mention.objectName);
      const resolved = bound ? (opts.registry.callableReturnTypes.get(bound) ?? bound) : undefined;
      if (resolved === typeName || (inTypeSection && members.has(mention.memberName))) {
        mentioned.add(mention.memberName);
      }
    }
  }

  if (members.size > 0) {
    const lines = opts.content.split('\n');
    const fenced = fencedLines(lines);
    for (const th of headings) {
      if (normalizeApiName(th.text) !== typeName) continue;
      const sectionEnd =
        headings.find((h) => h.line > th.line && h.level <= th.level)?.line ??
        Number.POSITIVE_INFINITY;
      for (let i = th.line; i < lines.length; i++) {
        const lineNo = i + 1;
        if (lineNo >= sectionEnd) break;
        if (fenced[i]) continue;
        const line = lines[i];
        for (const m of line.matchAll(BACKTICK)) {
          const token = unwrapApiToken(m[1]);
          if (members.has(token)) mentioned.add(token);
        }
      }
    }
  }
  return mentioned;
}

function gapLocator(
  file: string,
  typeName: string,
  memberNames: string[],
  headings: PageHeading[],
  existing: Claim[],
): Locator {
  const typeHeading = headings.find((h) => normalizeApiName(h.text) === typeName);
  if (typeHeading) return headingLocator(file, typeHeading);
  const memberHeading = headings.find((h) => memberNames.includes(normalizeApiName(h.text)));
  if (memberHeading) return headingLocator(file, memberHeading);
  const firstClaim = existing.find((c) => c.specRef?.export === typeName);
  const anchorLine = firstClaim?.locator.start.line ?? headings[0]?.line ?? 1;
  const heading = nearestHeading(headings, anchorLine) ?? headings[0];
  return heading
    ? headingLocator(file, heading)
    : { path: file, start: { line: 1, col: 1 }, end: { line: 1, col: 1 } };
}

function gapClaims(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  existing: Claim[],
): Claim[] {
  const { spec, registry, file } = opts;
  const types = joinTypes(opts, existing);
  if (types.size === 0) return [];

  const claims: Claim[] = [];
  const cited = new Set(
    existing.map((c) => specRefKey(c.specRef)).filter((k): k is string => k !== null),
  );

  const mapped = mappedPage(opts);
  const internal = new Set(mapped?.internal ?? []);

  for (const typeName of types) {
    const members = listedMembers(spec, typeName, typeName === mapped?.type ? internal : new Set());
    if (members.length === 0) continue;
    const mentioned = mentionedMembers(opts, typeName, existing, headings);
    const locator = gapLocator(file, typeName, members, headings, existing);

    for (const member of members) {
      if (mentioned.has(member)) continue;
      const specRef = makeSpecRef(spec, registry, typeName, member);
      const key = specRefKey(specRef);
      if (key && cited.has(key)) continue;
      pushUnique(claims, {
        id: claimId(file, 'gap', specRef, member, locator.start.line),
        kind: 'gap',
        text: member,
        locator,
        specRef,
        rule: {
          type: 'spec-not-in-claims',
          issue: `Spec member '${typeName}.${member}' is not mentioned on this page`,
          ...(specRef.signature ? { suggestion: `Document ${specRef.signature}` } : {}),
        },
        candidate: false,
      });
      if (key) cited.add(key);
    }
  }
  return claims;
}

function proseClaims(opts: BuildPageDocumentOptions, headings: PageHeading[]): Claim[] {
  const { spec, registry, file, content } = opts;
  const claims: Claim[] = [];
  for (const hit of findProseHits(content, spec, registry, headings, pageScope(opts).namespaces)) {
    const locator = attachHeading({ path: file, start: hit.start, end: hit.end }, headings);
    pushUnique(claims, {
      id: claimId(file, 'prose', hit.specRef, hit.text, locator.start.line),
      kind: 'prose',
      text: hit.text,
      locator,
      specRef: hit.specRef,
      candidate: true,
    });
  }
  return claims;
}

/**
 * Build a page-level document of claims, locators, and spec slices.
 *
 * Detection only. Hosts paint the JSON. A separate review product may Jev
 * `candidate` claims — this package does not.
 *
 * @param options - Spec, registry, and markdown page
 * @returns Page document for one markdown file
 */
export function buildPageDocument(options: BuildPageDocumentOptions): PageDocument {
  const file = posixPath(options.file);
  const opts: BuildPageDocumentOptions = { ...options, file };
  const packageName = opts.packageName ?? opts.spec.meta.name;
  const headings = collectHeadings(opts.content);
  const { parsed } = pageScope(opts);
  const issues = detectProseDrift({
    packageName,
    markdownFiles: [parsed],
    registry: opts.registry,
    spec: opts.spec,
    ...(opts.importSpecifier ? { importSpecifier: opts.importSpecifier } : {}),
    ...(opts.alsoSpecs?.length ? { alsoSpecs: opts.alsoSpecs } : {}),
  });

  const claims: Claim[] = [];
  for (const c of fenceClaims(opts, headings, issues)) pushUnique(claims, c);
  for (const c of callSiteClaims(opts, headings)) pushUnique(claims, c);
  const paramDocs = paramDocClaims(opts, headings);
  for (const c of paramDocs) pushUnique(claims, c);
  // A rule hit on a key cell replaces the rule-less inventory claim for that cell.
  const judged = new Set(paramDocs.map((c) => `${c.locator.start.line}:${c.locator.start.col}`));
  for (const c of tableKeyClaims(opts, headings)) {
    if (!c.rule && judged.has(`${c.locator.start.line}:${c.locator.start.col}`)) continue;
    pushUnique(claims, c);
  }
  for (const c of inlineClaims(opts, headings, claims)) pushUnique(claims, c);
  for (const c of headingClaims(opts, headings)) pushUnique(claims, c);
  for (const c of proseClaims(opts, headings)) pushUnique(claims, c);
  for (const c of gapClaims(opts, headings, claims)) pushUnique(claims, c);

  const ordered = sortClaims(claims);
  const refs = ordered.map((c) => c.specRef).filter((r): r is SpecRef => r !== null);

  return {
    packageName,
    path: file,
    ...(pageTitle(headings) ? { title: pageTitle(headings) } : {}),
    claims: ordered,
    slices: uniqueSlices(opts.spec, refs),
  };
}

/**
 * Build a page document for each markdown file.
 *
 * @param options - Spec, registry, and markdown pages
 * @returns One document per file, in input order
 */
export function buildPageDocuments(options: BuildPageDocumentsOptions): PageDocument[] {
  const { files, ...shared } = options;
  return files.map((f) => buildPageDocument({ ...shared, file: f.file, content: f.content }));
}
