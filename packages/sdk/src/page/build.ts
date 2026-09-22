import type { ApiSpec } from '../analysis/api-spec';
import { detectProseDrift } from '../analysis/drift/prose-drift';
import type { ExportRegistry, SpecDocDrift } from '../analysis/drift/types';
import { levenshtein } from '../analysis/drift/utils';
import {
  computeKeyCoverage,
  DEFAULT_SECTION_RE,
  extractDocumentedKeys,
  resolveTypeEntries,
} from '../analysis/key-coverage';
import { getExecutableLangs, parseMarkdownFile } from '../markdown/parser';
import type { MarkdownDocFile } from '../markdown/types';
import { closedObjectShape, detectCallSiteHits } from './call-sites';
import { extractFenceDeclarations } from './declarations';
import { ambiguousExports, fenceEntry } from './entries';
import {
  blockContaining,
  collectPackageNamespaces,
  diffView,
  extractCallSites,
  extractExportBindings,
  extractFenceCalls,
  extractFenceCommentMembers,
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
  frontmatterTitle,
  HEADING,
  headingAncestorNames,
  headingAncestors,
  headingLocator,
  isApiToken,
  isBuiltinName,
  isCallForm,
  isExportContext,
  isMemberToken,
  locateInFence,
  locateOnLine,
  nearestHeading,
  normalizeApiName,
  type PageHeading,
  pageTitle,
  unwrapApiToken,
} from './locators';
import { extractFenceMentions, type FenceMention } from './mentions';
import { findParamDocHits, paramDocBlocks } from './param-docs';
import { findProseHits, findProseOptionHits } from './prose';
import {
  makeSpecRef,
  preferredParents,
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
    // A `diff` fence, or a ts fence with `+` / `-` lines, is read as its "after" code.
    const raw = parseMarkdownFile(opts.content, opts.file, {
      executableLangs: [...getExecutableLangs(), 'diff'],
    });
    const parsed: MarkdownDocFile = {
      ...raw,
      codeBlocks: raw.codeBlocks.map((b) => ({ ...b, code: diffView(b.code).code })),
    };
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

/** Every member name the spec gives a type, private ones included: a printed private key is not wrong. */
function allMemberNames(spec: ApiSpec, typeName: string): string[] {
  const names = new Set<string>();
  for (const entry of resolveTypeEntries(spec, typeName)) {
    for (const member of entry.members ?? []) if (member.name) names.add(member.name);
  }
  return [...names];
}

const NEAR_MISS_DISTANCE = 2;

/**
 * `prose-declared-key`: a fence prints `interface X { ... }` / `type X = { ... }`
 * / `class X { ... }` for a spec type and declares a key that type does not
 * have. The declaration is the spec's when it is `export`ed, sits under a
 * heading that names X, or X is the page's docs-map type; a bare local
 * `interface X` elsewhere is the reader's. Silent when the spec shape is open
 * (index signature, unresolved base or arm, generic alias) or has no members.
 */
function declaredKeyClaims(opts: BuildPageDocumentOptions, headings: PageHeading[]): Claim[] {
  const { file, content } = opts;
  const packageName = opts.packageName ?? opts.spec.meta.name;
  const { parsed } = pageScope(opts);
  const mappedType = mappedPage(opts)?.type;
  const claims: Claim[] = [];

  for (const block of parsed.codeBlocks) {
    const { entry, unsure } = fenceScope(opts, block.code);
    const { spec, registry } = entry;
    if (
      isMigrationFence(content, block.lineStart, block.code) ||
      fenceImportKind(block.code, packageName, entry.specifier) === 'foreign'
    ) {
      continue;
    }
    const section = headingAncestorNames(headings, block.lineStart + 1);
    for (const decl of extractFenceDeclarations(block.code)) {
      const typeName = decl.name;
      if (unsure.has(typeName) || resolveTypeEntries(spec, typeName).length === 0) continue;
      if (!decl.exported && !section.includes(typeName) && mappedType !== typeName) continue;
      const shape = closedObjectShape(spec, typeName);
      if (!shape) continue;
      const allowed = [...new Set([...shape.keys, ...allMemberNames(spec, typeName)])];
      const specRef = makeSpecRef(spec, registry, typeName);
      for (const key of decl.keys) {
        if (key.name.startsWith('_') || allowed.includes(key.name)) continue;
        const loc = fenceLocator(file, content, block, key, headings);
        if (!loc) continue;
        const near = allowed
          .map((name) => ({ name, d: levenshtein(key.name.toLowerCase(), name.toLowerCase()) }))
          .filter((m) => m.d <= NEAR_MISS_DISTANCE)
          .sort((a, b) => a.d - b.d)[0];
        pushUnique(claims, {
          id: claimId(file, 'fence', specRef, key.text, loc.start.line, 'prose-declared-key'),
          kind: 'fence',
          text: key.text,
          locator: loc,
          specRef,
          rule: {
            type: 'prose-declared-key',
            issue: `'${key.name}' is not a member of '${typeName}'`,
            suggestion: near ? `Did you mean '${near.name}'?` : `Allowed: ${allowed.join(', ')}`,
          },
          candidate: false,
        });
      }
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
  const title = frontmatterTitle(content);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (fenced[i]) continue;
    if (HEADING.test(line)) continue;
    const lineNo = i + 1;
    if (headingLines.has(lineNo)) continue;

    for (const m of line.matchAll(BACKTICK)) {
      const raw = m[1];
      const name = unwrapApiToken(raw);
      const preferred = ancestorPreferred(opts, headings, lineNo);
      const after = line.slice((m.index ?? 0) + m[0].length);
      const ancestors = headingAncestors(headings, lineNo);
      // A builtin name is never a member by context: the export, or the language's.
      const isExport = registry.all.has(raw) && isExportContext(raw, { ancestors, title, after });
      if (!isApiToken(raw) && !isExport) continue;
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
  const bindingsOf = new Map<EntryScope, Map<string, string>>();
  for (const [index, block] of parsed.codeBlocks.entries()) {
    // A fence that imports a secondary entry mentions that entry's exports.
    const { entry, unsure } = fenceScope(opts, block.code);
    const { spec, registry, aliases, namespaces } = entry;
    const imports = extractFenceImports(block.code);
    const foreign = new Set(
      imports.filter((i) => !isPackageModule(i.from, packageName)).map((i) => i.name),
    );
    const notOurs = new Set([...extractLocalNames(block.code), ...shadowed[index], ...foreign]);
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
    const own: FenceMention[] = extractFenceMentions(block.code, {
      spec,
      registry,
      namespaces,
      aliases,
      bindings,
      notOurs,
    });
    // A fence that names no entry: a chained member is the primary's only when
    // no other entry types the same chain (`.parse()` is on both string types).
    const contested = new Set<string>();
    for (const other of unsure.size > 0 ? pageScope(opts).entries.slice(1) : []) {
      // The alias is the page's, whichever entry it was inferred from.
      const theirs = extractFenceMentions(block.code, {
        ...other,
        namespaces: new Set([...other.namespaces, ...namespaces]),
        bindings: new Map(),
        notOurs,
      });
      for (const m of theirs) if (m.member) contested.add(`${m.line}:${m.col}`);
    }
    const mentions = own.filter((m) => !m.member || !contested.has(`${m.line}:${m.col}`));
    for (const imp of imports) {
      if (imp.kind !== 'named' || foreign.has(imp.name)) continue;
      mentions.push({ exportName: imp.imported, text: imp.text, line: imp.line, col: imp.col });
    }

    const seen = new Set<string>();
    for (const m of mentions) {
      const key = m.member ? `${m.exportName}.${m.member}` : m.exportName;
      if ((!m.member && !registry.all.has(m.exportName)) || seen.has(key)) continue;
      seen.add(key);
      const specRef = makeSpecRef(spec, registry, m.exportName, m.member);
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

/** The export or `Type.member` a heading names, or null. */
function headingRef(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  heading: PageHeading,
): SpecRef | null {
  const { spec, registry } = opts;
  const name = normalizeApiName(heading.text);
  // `## number` is a word; `` ## `number` `` and `## number()` are the API.
  if (isBuiltinName(name) && !heading.code && !isCallForm(heading.text)) return null;
  return resolveApiName(
    spec,
    registry,
    name,
    ancestorPreferred(opts, headings, heading.line),
    pageScope(opts).namespaces,
  );
}

function headingClaims(opts: BuildPageDocumentOptions, headings: PageHeading[]): Claim[] {
  const { file } = opts;
  const claims: Claim[] = [];
  for (const heading of headings) {
    const specRef = headingRef(opts, headings, heading);
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

/** The types the whole page is about: its frontmatter title and docs-map type. */
function pageTypes(opts: BuildPageDocumentOptions): string[] {
  const { spec, registry } = opts;
  const types: string[] = [];
  const mapped = mappedPage(opts)?.type;
  if (mapped) types.push(mapped);
  const title = frontmatterTitle(opts.content);
  const ref = title
    ? resolveApiName(spec, registry, normalizeApiName(title), undefined, pageScope(opts).namespaces)
    : null;
  if (ref && !ref.member) types.push(ref.export);
  return types;
}

function ancestorPreferred(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  line: number,
): Set<string> | undefined {
  return preferredParents(opts.registry, headings, line, pageTypes(opts));
}

/** Lines a heading's section spans: the heading to the next one of its level or higher. */
function sectionRange(
  headings: PageHeading[],
  heading: PageHeading,
): { start: number; end: number } {
  const next = headings.find((h) => h.line > heading.line && h.level <= heading.level);
  return { start: heading.line, end: next?.line ?? Number.POSITIVE_INFINITY };
}

/** Fences that open inside a heading's section. */
function sectionFences(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  heading: PageHeading,
): MarkdownDocFile['codeBlocks'] {
  const { start, end } = sectionRange(headings, heading);
  return pageScope(opts).parsed.codeBlocks.filter((b) => b.lineStart >= start && b.lineStart < end);
}

/**
 * The fence imports `name` from the package, writes `new Name(` / `Name(` /
 * `Name.m(` / `<Name>`, or prints a declaration of it.
 */
function fenceShowsExport(
  code: string,
  name: string,
  packageName: string,
  namespaces: ReadonlySet<string>,
): boolean {
  if (
    extractFenceImports(code).some(
      (i) => i.imported === name && isPackageModule(i.from, packageName),
    )
  ) {
    return true;
  }
  if (extractFenceDeclarations(code).some((d) => d.name === name)) return true;
  return extractCallSites(code).some((s) =>
    s.objectName
      ? s.objectName === name || (namespaces.has(s.objectName) && s.name === name)
      : s.name === name,
  );
}

/** The page's H1 or frontmatter title resolves to `type` (or one of its members). */
function pageNamesType(opts: BuildPageDocumentOptions, headings: PageHeading[], type: string) {
  const { spec, registry } = opts;
  const titles = [pageTitle(headings), frontmatterTitle(opts.content)];
  return titles.some((title) => {
    if (!title) return false;
    const ref = resolveApiName(
      spec,
      registry,
      normalizeApiName(title),
      undefined,
      pageScope(opts).namespaces,
    );
    return ref?.export === type;
  });
}

/**
 * A heading that names an export joins the page to that type only with
 * evidence the section is about it: the heading is a code span or call form,
 * the page's H1 / frontmatter title names the type, a fence in the section
 * imports, constructs, calls or declares it, or the section walks its members
 * (`walksMembers`). A bare word that happens to be an export name (`## Output`
 * describing a tool's result shape) joins nothing.
 */
function headingJoins(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  heading: PageHeading,
  type: string,
  claims: Claim[],
): boolean {
  if (headingIsReference(opts, headings, heading, type)) return true;
  const packageName = opts.packageName ?? opts.spec.meta.name;
  const { namespaces } = pageScope(opts);
  if (
    sectionFences(opts, headings, heading).some((b) =>
      fenceShowsExport(b.code, type, packageName, namespaces),
    )
  ) {
    return true;
  }
  return walksMembers(opts, headings, type, claims);
}

/** Distinct public members a reference-style section names before it is on the hook for the rest. */
const WALKED_MEMBERS = 3;

/**
 * The section walks the type's members one by one: `WALKED_MEMBERS` distinct
 * public members named under the type's own heading by code-span labels
 * (`` `undo()` ``, `` `history.undo()` ``), `x.member(` calls on any receiver,
 * or `Type.member` text. Option keys do not count. A value of the type
 * reached through another call (`const history = doc.getHistory()`) is
 * evidence enough to join.
 */
function walksMembers(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  type: string,
  claims: Claim[],
): boolean {
  return (
    mentionedMembers(opts, type, claims, headings, { optionKeys: false }).size >= WALKED_MEMBERS
  );
}

/** The heading is written as the API (`` ## `X` ``, `## X()`), or the page is titled after the type. */
function headingIsReference(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  heading: PageHeading,
  type: string,
): boolean {
  return heading.code === true || isCallForm(heading.text) || pageNamesType(opts, headings, type);
}

/**
 * The section documents the type's surface: it prints a declaration of the
 * type, carries a parameter / option table (or `Parameters` list) whose
 * owner is the type or whose keys are members of it, or walks the type's
 * members one by one (`walksMembers`). A fence that merely uses the type
 * (one mock example on a testing guide) is not that.
 */
function sectionDocumentsType(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  heading: PageHeading,
  type: string,
  claims: Claim[],
): boolean {
  const { spec, registry, content } = opts;
  if (walksMembers(opts, headings, type, claims)) return true;
  if (
    sectionFences(opts, headings, heading).some((b) =>
      extractFenceDeclarations(b.code).some((d) => d.name === type),
    )
  ) {
    return true;
  }
  const { start, end } = sectionRange(headings, heading);
  const members = new Set(allMemberNames(spec, type));
  return paramDocBlocks(content, spec, registry, headings).some(
    (b) =>
      b.line >= start &&
      b.line < end &&
      (b.owner === type ||
        b.owner?.startsWith(`${type}.`) === true ||
        b.keys.some((k) => members.has(k))),
  );
}

/**
 * Types the page is on the hook for: the docs-mapped type, and every type a
 * heading joins (`headingJoins`) whose section documents the surface: the
 * heading is written as the API or the page is titled after the type
 * (`headingIsReference`), or the section prints a declaration or an option
 * table for it, or walks its members (`sectionDocumentsType`).
 */
function joinTypes(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  claims: Claim[],
): Set<string> {
  const types = new Set<string>();
  const mapped = mappedPage(opts);
  if (mapped) types.add(mapped.type);
  // Stronger than a mention: the page's own heading names the type or a member,
  // with evidence. Inline/fence citations stay inventory (candidate), never join.
  for (const heading of headings) {
    const specRef = headingRef(opts, headings, heading);
    if (!specRef) continue;
    const type = specRef.export;
    if (types.has(type)) continue;
    if (!specRef.member && listedMembers(opts.spec, type).length === 0) continue;
    if (!headingJoins(opts, headings, heading, type, claims)) continue;
    if (
      headingIsReference(opts, headings, heading, type) ||
      sectionDocumentsType(opts, headings, heading, type, claims)
    ) {
      types.add(type);
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

/**
 * Members of `typeName` the page names: claims on `Type.member`, `Type.member`
 * text, printed declarations, `x.member` on a receiver bound to the type (or
 * any member under the type's heading), code-span labels under the type's
 * heading, and (`optionKeys`, default on) option keys written to the type.
 */
function mentionedMembers(
  opts: BuildPageDocumentOptions,
  typeName: string,
  claims: Claim[],
  headings: PageHeading[],
  { optionKeys = true }: { optionKeys?: boolean } = {},
): Set<string> {
  const mentioned = new Set<string>();
  for (const c of claims) {
    if (c.specRef?.export === typeName && c.specRef.member) mentioned.add(c.specRef.member);
  }
  const escaped = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const qualified = new RegExp(`${escaped}\\.([A-Za-z_$][\\w$]*)`, 'g');
  for (const m of opts.content.matchAll(qualified)) mentioned.add(m[1]);

  const { parsed, namespaces } = pageScope(opts);
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
    // A printed `interface T { ... }` / `type T = { ... }` / `class T { ... }` documents its keys.
    for (const decl of extractFenceDeclarations(block.code)) {
      if (decl.name !== typeName) continue;
      for (const key of decl.keys) mentioned.add(key.name);
    }
    // An option key written to the type (`new T({ tools })`, `<T tools />`) names the member of that name.
    for (const site of optionKeys ? extractCallSites(block.code) : []) {
      const names = site.objectName
        ? namespaces.has(site.objectName)
          ? site.name
          : undefined
        : site.name;
      if (names !== typeName) continue;
      const keys = site.kind === 'jsx' ? site.jsxKeys : site.args.flatMap((a) => a.keys ?? []);
      for (const key of keys) if (members.has(key)) mentioned.add(key);
    }
    // Comments are trivia: `// server.port → 1999` teaches `port` under the same rules.
    const fenceMentions = [
      ...extractFenceMembers(block.code),
      ...extractFenceCommentMembers(block.code),
    ];
    for (const mention of fenceMentions) {
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
          // `member(...)` or `x.member(...)`: the label names the member, whatever the receiver.
          const token = unwrapApiToken(m[1]).split('.').pop() ?? '';
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
  const types = joinTypes(opts, headings, existing);
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
  for (const hit of findProseHits(
    content,
    spec,
    registry,
    headings,
    pageScope(opts).namespaces,
    pageTypes(opts),
  )) {
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
  for (const hit of findProseOptionHits(content, spec, registry, headings)) {
    const locator = attachHeading({ path: file, start: hit.start, end: hit.end }, headings);
    const specRef = makeSpecRef(spec, registry, hit.exportName);
    pushUnique(claims, {
      id: claimId(file, 'prose', specRef, hit.text, locator.start.line, hit.type),
      kind: 'prose',
      text: hit.text,
      locator,
      specRef,
      rule: { type: hit.type, issue: hit.issue, suggestion: hit.suggestion },
      candidate: false,
    });
  }
  return claims;
}

/**
 * Build a page-level document of claims, locators, and spec slices.
 *
 * Detection only. Hosts paint the JSON. A separate review product may Jev
 * `candidate` claims — this package does not. A migration "before" fence
 * (`isMigrationFence`) carries no claims at all.
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
  for (const c of declaredKeyClaims(opts, headings)) pushUnique(claims, c);
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

  // A "before" fence shows the old API on purpose: no claim, so no question is asked of it.
  const history = parsed.codeBlocks.filter((b) =>
    isMigrationFence(opts.content, b.lineStart, b.code),
  );
  const current = claims.filter(
    (c) =>
      !history.some(
        (b) => c.locator.start.line >= b.lineStart && c.locator.start.line <= b.lineEnd,
      ),
  );
  const ordered = sortClaims(current);
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
