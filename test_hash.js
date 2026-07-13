const crypto = require('crypto');
console.log(crypto.createHash('sha256').update('"S0b0ite$$2026!"').digest('hex'));
