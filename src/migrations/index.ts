import * as migration_20261010_084128_unique_optional_fields from './20261010_084128_unique_optional_fields';

export const migrations = [
  {
    up: migration_20261010_084128_unique_optional_fields.up,
    down: migration_20261010_084128_unique_optional_fields.down,
    name: '20261010_084128_unique_optional_fields'
  },
];
