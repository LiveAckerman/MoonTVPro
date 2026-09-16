/** @jest-environment node */
/* eslint-env jest */
/* eslint-disable @typescript-eslint/no-var-requires */

const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');
const createNextConfig = require('../../../next.config');

describe('Next 14 configuration', () => {
  it('uses the supported external-packages option without the Next 15 key', () => {
    const config = createNextConfig(PHASE_DEVELOPMENT_SERVER);
    expect(config).not.toHaveProperty('serverExternalPackages');
    expect(config.experimental.serverComponentsExternalPackages).toEqual(
      expect.arrayContaining([
        '@libsql/client',
        '@libsql/hrana-client',
        'libsql',
      ])
    );
  });
});
