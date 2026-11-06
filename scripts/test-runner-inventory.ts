import { parts } from '../src/parts';
import { catalogShardCount } from '../tests/helpers/part-contract';

// Preserve registry order: the existing contract wrappers assign families by index.
process.stdout.write(JSON.stringify({ partIds: parts.map((part) => part.id), catalogShardCount }));
