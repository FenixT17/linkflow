import { createServerClient, ID } from '../src/lib/appwrite.server.js';
const s = createServerClient();
const db = s.databases;
console.log('DB OK');
const collections = await db.listCollections(ID.unique());
console.log('Collections:', collections.total);
for (const c of collections.documents) {
  console.log('-', c.id, '| attrs:', (c.attributes ?? []).length, '| permissions:', (c.permissions ?? []).length);
  if (c.attributes) {
    for (const a of c.attributes) console.log('    ', a.key, a.type, a.required ? 'REQ' : '', a.default || '');
  }
}
