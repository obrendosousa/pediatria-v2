from src.ai.voice.server import app, SpeechRequest
from fastapi.testclient import TestClient
client = TestClient(app)

response = client.post("/v1/audio/speech", json={"input": "Oi, Clara testando aqui!", "voice": "pf_dora"})
print("Status Code:", response.status_code)
if response.status_code == 200:
    with open("test-output.wav", "wb") as f:
        f.write(response.content)
    print("Saved test-output.wav")
else:
    print("Error:", response.text)
