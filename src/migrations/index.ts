import * as migration_20261010_084128_unique_optional_fields from './20261010_084128_unique_optional_fields';
import * as migration_20261125_145500_site_name from './20261125_145500_site_name';

export const migrations = [
  {
    up: migration_20261010_084128_unique_optional_fields.up,
    down: migration_20261010_084128_unique_optional_fields.down,
    name: '20261010_084128_unique_optional_fields'
  },
  {
    up: migration_20261125_145500_site_name.up,
    down: migration_20261125_145500_site_name.down,
    name: '20261125_145500_site_name'
  },
];
