const path = require('path');
const { getDb } = require(path.resolve(__dirname, '../dist/server/db.js'));
const db = getDb();
db.prepare("UPDATE pacts SET title = 'Bellandur Office Meetup' WHERE id = 'pact_bellandur_01'").run();
console.log('Title updated successfully.');
