import { getAgentUrl, buildHeaders } from './agentUrl';
import type { DocRef } from './refRegistry';
import { PointerRegistry } from './refRegistry';

const AGENT_URL = getAgentUrl();

export type AskType = 'testprd' | 'testpoint' | 'testcase';

export type TestCaseOutputFormat = 'xmind' | 'table' | 'yaml';

export type AskOptions = {
  sessionId: string;
  type: AskType;
  instruction?: string;

  /**
   * Old protocol compatibility: send text + additionalPrds.
   * If text is non-empty, backend will store it as main doc (and may set raw_prd pointer for testprd).
   */
  text?: string;
  additionalPrds?: Array<{ title: string; content: string }>;

  /**
   * New protocol: docRefs-only.
   * If provided, takes precedence over pointers-derived main.
   */
  docRefs?: DocRef[];

  /**
   * Optional: explicit aux docIds list appended as kind=aux
   */
  auxDocIds?: string[];

  /**
   * Optional: PointerRegistry; used to derive main docId and to auto-update pointers on response.
   */
  pointers?: PointerRegistry;

  /**
   * Output format for testcase generation (xmind/table/yaml).
   * Only applicable when type='testcase'.
   */
  outputFormat?: TestCaseOutputFormat;
};

export type AskResponseV2 = {
  status: 'success' | 'error';
  sessionId: string;
  answer: string;
  code?: string;
  message?: string;
  docRefs?: DocRef[];
  usedDocRefs?: DocRef[];
  generatedDocRef?: DocRef | null;
};

/**
 * Build payload: prefer docRefs > text > pointers.
 */
export function buildAskPayload(opts: AskOptions): { sessionId: string; type: AskType; params: { text: string }; instruction?: string; additionalPrds?: any; docRefs?: DocRef[]; outputFormat?: TestCaseOutputFormat } {
  const { sessionId, type, instruction, text, additionalPrds, docRefs, auxDocIds = [], pointers, outputFormat } = opts;

  // 1) Explicit docRefs
  if (docRefs && docRefs.length > 0) {
    const merged: DocRef[] = [...docRefs];
    for (const did of auxDocIds) merged.push({ docId: did, kind: 'aux' });
    return {
      sessionId,
      type,
      params: { text: '' },
      instruction,
      additionalPrds,
      docRefs: merged,
      outputFormat,
    };
  }

  // 2) Old protocol if text present
  if (text && text.trim()) {
    return {
      sessionId,
      type,
      params: { text: text.trim() },
      instruction,
      additionalPrds,
      outputFormat,
    };
  }

  // 3) pointers-derived docRefs-only
  if (!pointers) {
    throw new Error(`buildAskPayload: docRefs/text missing and pointers not provided (type=${type})`);
  }
  const mainDocId = pointers.getMainDocId(type);
  const derived: DocRef[] = [];
  if (mainDocId) derived.push({ docId: mainDocId, kind: 'main' });
  for (const did of auxDocIds) derived.push({ docId: did, kind: 'aux' });

  if (derived.length === 0 && !(additionalPrds && additionalPrds.length)) {
    throw new Error(`buildAskPayload: cannot derive docRefs for type=${type}. Ensure pointers has the main logicalId set.`);
  }

  return {
    sessionId,
    type,
    params: { text: '' },
    instruction,
    additionalPrds,
    docRefs: derived.length ? derived : undefined,
    outputFormat,
  };
}

/**
 * Unified ask call (buttons + stage chats can use this).
 * - Supports docRefs-only mode (fast, no repeated big uploads)
 * - Auto-updates pointers if response.generatedDocRef.logicalId exists
 */
export async function askV2(opts: AskOptions): Promise<AskResponseV2> {
  const payload = buildAskPayload(opts);

  const res = await fetch(`${AGENT_URL}/api/ask`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as AskResponseV2;

  if (data.status === 'success') {
    // auto-update pointers
    const gen = data.generatedDocRef;
    if (gen?.logicalId && gen.docId && opts.pointers) {
      opts.pointers.set(gen.logicalId, gen.docId);
      // best effort sync delta
      try {
        await opts.pointers.sync({ [gen.logicalId]: gen.docId });
      } catch (e) {
        // not fatal for UX
        console.warn('[askV2] failed to sync pointers:', e);
      }
    }
  }

  return data;
}
