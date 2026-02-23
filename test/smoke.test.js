const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('project has required frontend/backend entry files', () => {
  const requiredFiles = [
    'server.js',
    path.join('public', 'index.html'),
    path.join('public', 'app.js'),
    path.join('public', 'styles.css'),
  ];

  for (const file of requiredFiles) {
    assert.equal(fs.existsSync(file), true, `Missing required file: ${file}`);
  }
});
