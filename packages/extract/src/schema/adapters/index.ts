import { registerAdapter } from '../registry';
import { arktypeAdapter } from './arktype';
import { typeboxAdapter } from './typebox';
import { valibotAdapter } from './valibot';
import { zodAdapter } from './zod';

// Export adapters
export { arktypeAdapter } from './arktype';
export { typeboxAdapter } from './typebox';
export { valibotAdapter } from './valibot';
export { zodAdapter } from './zod';

// Register all adapters
registerAdapter(zodAdapter);
registerAdapter(valibotAdapter);
registerAdapter(arktypeAdapter);
registerAdapter(typeboxAdapter);
