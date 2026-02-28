import https from "http";
const data = JSON.stringify({
  model: "kokoro",
  input: "Isso é um teste do Next.js chamando o servidor Python.",
  voice: "pf_dora",
  lang_code: "p",
  response_format: "mp3"
});

const options = {
  hostname: 'localhost',
  port: 8880,
  path: '/v1/audio/speech',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write("Recebeu dados do buffer de audio\n");
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
