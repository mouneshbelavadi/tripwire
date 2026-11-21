/**
 * Strict Workspace Tenant Boundaries & Isolation
 *
 * Enforces workspace_id filtering on database queries and provides
 * verification utilities to assert no query can return records from a foreign workspace.
 */

export class TenantIsolationError extends Error {
  public readonly expectedWorkspaceId: string;
  public readonly violatingWorkspaceId?: string;
  public readonly entityName?: string;

  constructor(
    message: string,
    expectedWorkspaceId: string,
    violatingWorkspaceId?: string,
    entityName?: string
  ) {
    super(message);
    this.name = 'TenantIsolationError';
    this.expectedWorkspaceId = expectedWorkspaceId;
    this.violatingWorkspaceId = violatingWorkspaceId;
    this.entityName = entityName;
    Object.setPrototypeOf(this, TenantIsolationError.prototype);
  }
}

export interface TenantScopedRecord {
  workspace_id?: string;
  workspaceId?: string;
  [key: string]: any;
}

/**
 * Asserts that a record or collection of records belongs exclusively to the expected workspace.
 * Throws TenantIsolationError if any record has a foreign workspace_id.
 */
export function assertTenantIsolation<T extends TenantScopedRecord>(
  records: T | T[] | null | undefined,
  expectedWorkspaceId: string,
  entityName = 'record'
): void {
  if (!expectedWorkspaceId || typeof expectedWorkspaceId !== 'string') {
    throw new TenantIsolationError(
      'Invalid expectedWorkspaceId provided for isolation check',
      expectedWorkspaceId
    );
  }

  if (records === null || records === undefined) {
    return;
  }

  const items = Array.isArray(records) ? records : [records];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    const actualWorkspaceId = item.workspace_id ?? item.workspaceId;

    if (actualWorkspaceId !== undefined && actualWorkspaceId !== expectedWorkspaceId) {
      throw new TenantIsolationError(
        `Cross-tenant access violation: ${entityName} belongs to workspace "${actualWorkspaceId}", but execution context is "${expectedWorkspaceId}"`,
        expectedWorkspaceId,
        actualWorkspaceId,
        entityName
      );
    }

    // Inspect nested relation arrays if present (e.g. members, plans, decisions)
    for (const [key, value] of Object.entries(item)) {
      if (Array.isArray(value)) {
        for (const subItem of value) {
          if (subItem && typeof subItem === 'object') {
            const subWs = subItem.workspace_id ?? subItem.workspaceId;
            if (subWs !== undefined && subWs !== expectedWorkspaceId) {
              throw new TenantIsolationError(
                `Cross-tenant access violation in nested ${key}: belongs to workspace "${subWs}", context is "${expectedWorkspaceId}"`,
                expectedWorkspaceId,
                subWs,
                `${entityName}.${key}`
              );
            }
          }
        }
      }
    }
  }
}

/**
 * Enforces workspace_id filter into a where clause.
 * If where clause already specifies a conflicting workspace_id, throws TenantIsolationError.
 */
export function scopeWhereClause<T extends Record<string, any>>(
  where: T = {} as T,
  workspaceId: string
): T & { workspace_id: string } {
  if (!workspaceId) {
    throw new TenantIsolationError('Cannot scope query without a valid workspaceId', workspaceId);
  }

  const existingWs = where.workspace_id ?? where.workspaceId;
  if (existingWs !== undefined && existingWs !== workspaceId) {
    throw new TenantIsolationError(
      `Attempted to query foreign workspace "${existingWs}" within workspace context "${workspaceId}"`,
      workspaceId,
      existingWs
    );
  }

  return {
    ...where,
    workspace_id: workspaceId,
  };
}

export interface TenantContext {
  workspaceId: string;
  scopeWhere: <T extends Record<string, any>>(where?: T) => T & { workspace_id: string };
  assertRecords: <T extends TenantScopedRecord>(records: T | T[] | null | undefined, entityName?: string) => void;
  executeScopedQuery: <T extends TenantScopedRecord>(
    queryFn: (scopedWhere: Record<string, any>) => Promise<T[]>,
    baseWhere?: Record<string, any>,
    entityName?: string
  ) => Promise<T[]>;
}

/**
 * Creates an execution context bound to a single workspace.
 */
export function createTenantContext(workspaceId: string): TenantContext {
  if (!workspaceId || typeof workspaceId !== 'string') {
    throw new TenantIsolationError('Invalid workspaceId provided for TenantContext', workspaceId);
  }

  return {
    workspaceId,
    scopeWhere: <T extends Record<string, any>>(where?: T) => scopeWhereClause(where, workspaceId),
    assertRecords: <T extends TenantScopedRecord>(records: T | T[] | null | undefined, entityName?: string) =>
      assertTenantIsolation(records, workspaceId, entityName),
    executeScopedQuery: async <T extends TenantScopedRecord>(
      queryFn: (scopedWhere: Record<string, any>) => Promise<T[]>,
      baseWhere?: Record<string, any>,
      entityName?: string
    ): Promise<T[]> => {
      const scopedWhere = scopeWhereClause(baseWhere, workspaceId);
      const results = await queryFn(scopedWhere);
      assertTenantIsolation(results, workspaceId, entityName);
      return results;
    },
  };
}

/**
 * Wraps a database client / repository with strict tenant isolation.
 * Automatically injects workspace_id into queries and verifies results.
 */
export function createScopedDbClient<T extends Record<string, any>>(
  dbClient: T,
  workspaceId: string
): T {
  const context = createTenantContext(workspaceId);

  return new Proxy(dbClient, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver);

      if (typeof original === 'function') {
        return async (...args: any[]) => {
          // If first argument is an options object containing 'where', scope it
          if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
            if ('where' in args[0]) {
              args[0].where = context.scopeWhere(args[0].where);
            } else if (prop.toString().startsWith('find') || prop.toString().startsWith('get')) {
              args[0] = context.scopeWhere(args[0]);
            }
          }

          const result = await (original as any).apply(target, args);
          context.assertRecords(result, String(prop));
          return result;
        };
      }

      // If it's a model accessor (e.g. prisma.plan, prisma.member)
      if (typeof original === 'object' && original !== null) {
        return createScopedDbClient(original, workspaceId);
      }

      return original;
    },
  });
}

/**
 * Verification utility that executes queries against two different workspaces
 * and asserts that no records leak across workspace boundaries.
 */
export async function verifyQueryIsolation<T extends TenantScopedRecord>(
  queryExecutor: (wsId: string) => Promise<T[]>,
  testWorkspaceId: string,
  foreignWorkspaceId: string
): Promise<{ isolated: boolean; testRecordCount: number; foreignRecordCount: number }> {
  const testResults = await queryExecutor(testWorkspaceId);
  const foreignResults = await queryExecutor(foreignWorkspaceId);

  // Assert all test results belong to test workspace
  assertTenantIsolation(testResults, testWorkspaceId, 'testQuery');

  // Assert all foreign results belong to foreign workspace
  assertTenantIsolation(foreignResults, foreignWorkspaceId, 'foreignQuery');

  // Assert disjoint sets: no test records in foreign results and vice versa
  for (const tr of testResults) {
    const ws = tr.workspace_id ?? tr.workspaceId;
    if (ws === foreignWorkspaceId) {
      throw new TenantIsolationError(
        `Isolation verification failed: record from "${foreignWorkspaceId}" leaked into "${testWorkspaceId}" query`,
        testWorkspaceId,
        foreignWorkspaceId
      );
    }
  }

  for (const fr of foreignResults) {
    const ws = fr.workspace_id ?? fr.workspaceId;
    if (ws === testWorkspaceId) {
      throw new TenantIsolationError(
        `Isolation verification failed: record from "${testWorkspaceId}" leaked into "${foreignWorkspaceId}" query`,
        foreignWorkspaceId,
        testWorkspaceId
      );
    }
  }

  return {
    isolated: true,
    testRecordCount: testResults.length,
    foreignRecordCount: foreignResults.length,
  };
}
