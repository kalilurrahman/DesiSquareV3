// Offline smoke of the inbound pipeline (no server, no WhatsApp, no Discourse).
import os from 'node:os';
import path from 'node:path';
import { Store } from '../src/store.js';
import { handleInbound } from '../src/bridge.js';

const store = new Store(path.join(os.tmpdir(), `wa-smoke-${Date.now()}.json`));
const config = { allowedGroups: [], discourse: { mirrorCategory: 'ask-the-community', guestUsername: 'system' }, phoneHashSalt: 'salt' };
const discourse = { posts: [], async postAsUser(p) { this.posts.push(p); } };

store.mapPhone('+14155550172', 'rohit', 42);
console.log('mapped @rohit -> +1415…');
console.log('mapped:', await handleInbound({ id: 'a', groupJid: 'g', phone: '+1 415 555 0172', text: 'How does DTAA work for US-India gains?' }, { store, discourse, config }));
console.log('dup:   ', await handleInbound({ id: 'a', groupJid: 'g', phone: '+14155550172', text: 'same id again' }, { store, discourse, config }));
console.log('guest: ', await handleInbound({ id: 'b', groupJid: 'g', phone: '+14150000000', text: 'unmapped sender msg' }, { store, discourse, config }));
console.log('\nposts created:', discourse.posts.length);
console.log('post authors:', discourse.posts.map((p) => '@' + p.username).join(', '));
console.log('phone leaked in any post?:', discourse.posts.some((p) => JSON.stringify(p).includes('4150000000') || JSON.stringify(p).includes('4155550172')));
