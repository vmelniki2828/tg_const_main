const dns = require('dns');
const https = require('https');

// Docker's DNS proxy can fail while direct DNS and HTTPS still work.
// Only Telegram HTTPS uses this fallback; MongoDB keeps Docker service DNS.
function lookup(hostname, options, callback) {
  dns.lookup(hostname, options, (error, address, family) => {
    if (!error || !['EAI_AGAIN', 'ENOTFOUND'].includes(error.code)) {
      return callback(error, address, family);
    }
    const resolver = new dns.Resolver({ timeout: 2000, tries: 1 });
    resolver.setServers(['1.1.1.1', '8.8.8.8']);
    resolver.resolve4(hostname, (fallbackError, addresses) => {
      if (fallbackError || !addresses?.length) return callback(fallbackError || error);
      if (options?.all) return callback(null, addresses.map(address => ({ address, family: 4 })));
      callback(null, addresses[0], 4);
    });
  });
}

module.exports = new https.Agent({ keepAlive: true, lookup });
