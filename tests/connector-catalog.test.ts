import { describe, expect, it } from 'vitest';
import { connectorCatalog, defaultDesign } from '../src/shared/contracts';

describe('connector catalog', () => {
  it('never presents planned services as ready to connect', () => {
    for (const service of connectorCatalog.filter((entry) => entry.status === 'planned')) {
      expect(service.reads).toBe('No data is read');
      expect(service.permissions).toEqual([]);
    }
  });

  it('keeps the starter desk independent of external connections', () => {
    expect(defaultDesign.columns).toBe(2);
    expect(defaultDesign.cardOrder).toEqual(expect.arrayContaining(['focus', 'projects', 'connections', 'routines', 'notes']));
  });

  it('documents an installer-owned setup route for every service', () => {
    for (const service of connectorCatalog) {
      expect(service.auth).not.toEqual('');
      expect(service.retention).not.toEqual('');
      expect(service.setupTime).not.toEqual('');
    }
  });
});
