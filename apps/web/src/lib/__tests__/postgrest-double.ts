/*
  A scripted PostgREST double for unit tests over admin-client code paths.

  Not a fake database: it answers a chain with whatever the test scripted for
  that table and verb, and records every call so a test can assert on what was
  written and in what order. The real database guarantees (RLS, unique
  indexes, atomic RPCs) belong to the `.db.test.ts` suites; this exists so the
  decision logic above them can be pinned without a live project.
*/

export type Reply = { data?: unknown; error?: unknown };
export type Call = {
  table: string;
  verb: "select" | "insert" | "update" | "delete";
  payload?: unknown;
  filters: Record<string, unknown>;
};
export type Script = Record<string, Reply | ((call: Call) => Reply)>;

/**
 * A thenable query builder. PostgREST chains terminate in several different
 * ways (`single`, `maybeSingle`, or awaiting the builder itself), so all
 * three resolve through the same path.
 */
class Query implements PromiseLike<Reply> {
  private filters: Record<string, unknown> = {};

  constructor(
    private readonly db: PostgrestDouble,
    private readonly table: string,
    private readonly verb: Call["verb"],
    private readonly payload?: unknown,
  ) {}

  select() {
    return this;
  }
  eq(key: string, value: unknown) {
    this.filters[key] = value;
    return this;
  }
  in(key: string, value: unknown) {
    this.filters[key] = value;
    return this;
  }
  lte() {
    return this;
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }

  private run(): Promise<Reply> {
    const call: Call = {
      table: this.table,
      verb: this.verb,
      payload: this.payload,
      filters: this.filters,
    };
    this.db.calls.push(call);
    return Promise.resolve(this.db.reply(call));
  }

  maybeSingle() {
    return this.run();
  }
  single() {
    return this.run();
  }
  then<A, B>(
    onfulfilled?: ((value: Reply) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export class PostgrestDouble {
  calls: Call[] = [];
  private script: Script = {};

  /** Replace the script and clear the call log. */
  setScript(script: Script) {
    this.script = script;
    this.calls = [];
  }

  reply(call: Call): Reply {
    const entry = this.script[`${call.table}.${call.verb}`] ?? this.script[call.table];
    const result = typeof entry === "function" ? entry(call) : entry;
    return result ?? { data: null, error: null };
  }

  /** Every recorded call against `table`, in order. */
  callsTo(table: string, verb?: Call["verb"]) {
    return this.calls.filter((c) => c.table === table && (!verb || c.verb === verb));
  }

  /** The client object to hand to code under test. */
  get client() {
    return {
      from: (table: string) => ({
        select: () => new Query(this, table, "select"),
        insert: (payload: unknown) => new Query(this, table, "insert", payload),
        update: (payload: unknown) => new Query(this, table, "update", payload),
        delete: () => new Query(this, table, "delete"),
      }),
    };
  }
}
