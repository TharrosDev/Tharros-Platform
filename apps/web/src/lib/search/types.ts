/**
 * Workspace search result shapes shared by the command palette (client) and
 * the search server action. Pure types, no server-only imports.
 */

export type SearchHit = {
  id: string;
  label: string;
  /** Secondary line: who asked, file status, employee email. */
  hint: string | null;
  href: string;
};

export type WorkspaceSearchResults = {
  conversations: SearchHit[];
  documents: SearchHit[];
  employees: SearchHit[];
};

export const EMPTY_RESULTS: WorkspaceSearchResults = {
  conversations: [],
  documents: [],
  employees: [],
};
