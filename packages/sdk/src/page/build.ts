import { detectProseDrift } from '../analysis/drift/prose-drift';
import type { ExportRegistry, SpecDocDrift } from '../analysis/drift/types';
import {
  computeKeyCoverage,
  DEFAULT_SECTION_RE,
  extractDocumentedKeys,
} from '../analysis/key-coverage';
import { findExportReferences, parseMarkdownFile } from '../markdown/parser';
import { blockContaining, extractFenceCalls, extractFenceImports } from './fences';
import {
  attachHeading,
  collectHeadings,
  FENCE,
  HEADING,
  headingLocator,
  locateOnLine,
  locateSpan,
  nearestHeading,
  normalizeApiName,
  type PageHeading,
  pageTitle,
} from './locators';
import {
  makeSpecRef,
  resolveApiName,
  resolveCall,
  specRefKey,
  typeKeyMeta,
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

const BACKTICK = /`([^`\n]+)`/g;
const KIND_ORDER: Record<ClaimKind, number> = {
  fence: 0,
  'table-key': 1,
  inline: 2,
  heading: 3,
  prose: 4,
  gap: 5,
};

function posixPath(file: string): string {
  return file.replace(/\\/g, '/').replace(/^\.\//, '');
}

function pageMatches(mapPage: string, file: string): boolean {
  const a = posixPath(mapPage);
  const b = posixPath(file);
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
): string {
  const target = specRefKey(specRef) ?? text;
  return `${path}:${kind}:${target}:${line}`;
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
  return `${claim.kind}:${specRefKey(claim.specRef) ?? claim.text}:${claim.locator.start.line}`;
}

function pushUnique(claims: Claim[], claim: Claim): void {
  const key = seenKey(claim);
  if (claims.some((c) => seenKey(c) === key || c.id === claim.id)) return;
  claims.push(claim);
}

function locatorForSpan(
  path: string,
  content: string,
  span: string,
  hintLine: number,
  headings: PageHeading[],
  fallbackLine?: number,
): Locator | null {
  const found = locateSpan(content, span, hintLine) ?? locateSpan(content, span, fallbackLine);
  if (!found) return null;
  return attachHeading({ path, start: found.start, end: found.end }, headings);
}

function fenceClaims(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  issues: SpecDocDrift[],
): Claim[] {
  const { spec, registry, file, content } = opts;
  const parsed = parseMarkdownFile(content, file);
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
    const hintLine = issue.line ?? 1;
    const block = blockContaining(parsed.codeBlocks, hintLine);
    let text = target;
    let specRef: SpecRef | null = null;
    let loc: Locator | null = null;

    if (block) {
      const calls = extractFenceCalls(block.code);
      const matchCall = calls.find(
        (c) =>
          c.methodName === target ||
          `${c.objectName}.${c.methodName}` === target ||
          c.objectName === target,
      );
      if (matchCall) {
        text = matchCall.text;
        specRef = resolveCall(spec, registry, matchCall.objectName, matchCall.methodName);
        loc = locatorForSpan(file, content, text, hintLine, headings, block.lineStart + 1);
      } else {
        const imp = extractFenceImports(block.code).find((i) => i.name === target);
        if (imp) {
          text = imp.text;
          specRef = resolveApiName(spec, registry, imp.name);
          loc = locatorForSpan(file, content, text, hintLine, headings, block.lineStart + 1);
        }
      }
    }

    if (!loc) {
      loc = locatorForSpan(file, content, text, hintLine, headings);
    }
    if (!loc) {
      const token = target.includes('.') ? (target.split('.').pop() ?? target) : target;
      const found = locateOnLine(content, hintLine, token) ?? locateSpan(content, token, hintLine);
      if (found) loc = attachHeading({ path: file, ...found }, headings);
    }
    if (!loc) continue;
    if (!specRef) specRef = resolveApiName(spec, registry, target);

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
          : resolveApiName(spec, registry, key);
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

  if (coverage && parentType) {
    const sectionHeading = headings.find((h) => sectionRe.test(h.text)) ?? headings[0];
    for (const gap of coverage.gaps.userFacing) {
      const specRef = makeSpecRef(spec, registry, parentType, gap.key);
      const locator = sectionHeading
        ? headingLocator(file, sectionHeading)
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

function inlineClaims(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  existing: Claim[],
): Claim[] {
  const { spec, registry, file, content } = opts;
  const claims: Claim[] = [];
  const lines = content.split('\n');
  let inFence = false;
  const headingLines = new Set(headings.map((h) => h.line));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (HEADING.test(line)) continue;
    const lineNo = i + 1;
    if (headingLines.has(lineNo)) continue;

    for (const m of line.matchAll(BACKTICK)) {
      const raw = m[1];
      const name = normalizeApiName(raw);
      const specRef = resolveApiName(spec, registry, name);
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

  const parsed = parseMarkdownFile(content, file);
  const exportNames = [...registry.all];
  for (const ref of findExportReferences([parsed], exportNames)) {
    if (posixPath(ref.file) !== posixPath(file)) continue;
    const specRef = resolveApiName(spec, registry, ref.exportName);
    if (!specRef) continue;
    const already = existing
      .concat(claims)
      .some(
        (c) =>
          specRefKey(c.specRef) === specRefKey(specRef) &&
          (c.kind === 'fence' || c.locator.start.line === ref.line),
      );
    if (already) continue;
    const found =
      locateOnLine(content, ref.line, ref.exportName) ??
      locateSpan(content, ref.exportName, ref.line);
    if (!found) continue;
    const locator = attachHeading({ path: file, start: found.start, end: found.end }, headings);
    pushUnique(claims, {
      id: claimId(file, 'inline', specRef, ref.exportName, locator.start.line),
      kind: 'inline',
      text: ref.exportName,
      locator,
      specRef,
      candidate: true,
    });
  }

  return claims;
}

function headingClaims(
  opts: BuildPageDocumentOptions,
  headings: PageHeading[],
  existing: Claim[],
): Claim[] {
  const { spec, registry, file } = opts;
  const preferred = preferredParents(existing, registry);
  const claims: Claim[] = [];
  for (const heading of headings) {
    const name = normalizeApiName(heading.text);
    const specRef = resolveApiName(spec, registry, name, preferred);
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

function preferredParents(claims: Claim[], registry: ExportRegistry): Set<string> {
  const parents = new Set<string>();
  for (const c of claims) {
    if (c.specRef?.member) parents.add(c.specRef.export);
    if (c.specRef && !c.specRef.member) {
      const ret = registry.callableReturnTypes.get(c.specRef.export);
      if (ret) parents.add(ret);
    }
  }
  return parents;
}

function joinTypes(opts: BuildPageDocumentOptions, claims: Claim[]): Set<string> {
  const types = new Set<string>();
  const mapped = mappedPage(opts);
  if (mapped) types.add(mapped.type);
  for (const c of claims) {
    if (c.specRef?.member) types.add(c.specRef.export);
    if (c.specRef && !c.specRef.member) {
      const ret = opts.registry.callableReturnTypes.get(c.specRef.export);
      if (ret) types.add(ret);
    }
  }
  return types;
}

function mentionedMembers(
  opts: BuildPageDocumentOptions,
  typeName: string,
  claims: Claim[],
): Set<string> {
  const mentioned = new Set<string>();
  for (const c of claims) {
    if (c.specRef?.export === typeName && c.specRef.member) mentioned.add(c.specRef.member);
  }
  const escaped = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const qualified = new RegExp(`${escaped}\\.([A-Za-z_$][\\w$]*)`, 'g');
  for (const m of opts.content.matchAll(qualified)) mentioned.add(m[1]);
  return mentioned;
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

  for (const typeName of types) {
    const keys = typeKeyMeta(spec, typeName);
    if (keys.size === 0) continue;
    const mentioned = mentionedMembers(opts, typeName, existing);
    const firstClaim = existing.find((c) => c.specRef?.export === typeName);
    const anchorLine = firstClaim?.locator.start.line ?? headings[0]?.line ?? 1;
    const heading = nearestHeading(headings, anchorLine) ?? headings[0];
    const locator = heading
      ? headingLocator(file, heading)
      : { path: file, start: { line: 1, col: 1 }, end: { line: 1, col: 1 } };

    for (const member of keys.keys()) {
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
  const parsed = parseMarkdownFile(opts.content, file);
  const issues = detectProseDrift({
    packageName,
    markdownFiles: [parsed],
    registry: opts.registry,
  });

  const claims: Claim[] = [];
  for (const c of fenceClaims(opts, headings, issues)) pushUnique(claims, c);
  for (const c of tableKeyClaims(opts, headings)) pushUnique(claims, c);
  for (const c of inlineClaims(opts, headings, claims)) pushUnique(claims, c);
  for (const c of headingClaims(opts, headings, claims)) pushUnique(claims, c);
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
  return options.files.map((f) =>
    buildPageDocument({
      spec: options.spec,
      registry: options.registry,
      file: f.file,
      content: f.content,
      docsMap: options.docsMap,
      packageName: options.packageName,
    }),
  );
}
