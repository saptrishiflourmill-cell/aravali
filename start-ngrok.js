const ngrok = require('ngrok');
(async () => {
  try {
    const url = await ngrok.connect(3000);
    console.log('NGROK_URL:' + url);
  } catch (e) {
    console.error('NGROK_ERR:' + e.message);
    process.exit(1);
  }
})();
