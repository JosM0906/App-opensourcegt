
import http from 'http';

http.get('http://127.0.0.1:4040/api/tunnels', (resp) => {
  let data = '';

  // A chunk of data has been received.
  resp.on('data', (chunk) => {
    data += chunk;
  });

  // The whole response has been received. Print out the result.
  resp.on('end', () => {
    try {
        const json = JSON.parse(data);
        const tunnel = json.tunnels.find(t => t.proto === 'https');
        if (tunnel) {
            console.log("NGROK_URL=" + tunnel.public_url);
        } else {
            console.log("NO_HTTPS_TUNNEL");
        }
    } catch(e) {
        console.error(e.message);
    }
  });

}).on("error", (err) => {
  console.log("Error: " + err.message);
});
