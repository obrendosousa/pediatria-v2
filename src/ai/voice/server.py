# src/ai/voice/server.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.responses import Response
from kokoro import KPipeline
import soundfile as sf
import io
import torch

app = FastAPI(title="Clara Local TTS Server", version="1.0.0")

# Initialize Pipeline on CPU automatically. Assuming 'p' applies to Portuguese.
# Force CPU device, effectively solving the CUDA deserialization issue
device = "cpu"

pipeline = KPipeline(lang_code='p', device=device) # 'p' is Portuguese in Kokoro v1.0

class SpeechRequest(BaseModel):
    model: str = "kokoro"
    input: str
    voice: str = "pf_dora"
    lang_code: str = "p"
    response_format: str = "mp3" # Can generate wav natively, we'll convert/save on the fly if needed

@app.post("/v1/audio/speech")
async def generate_speech(req: SpeechRequest):
    if not req.input.strip():
        raise HTTPException(status_code=400, detail="Input text is empty")
        
    try:
        # Generate audio using Kokoro
        generator = pipeline(
            req.input,
            voice=req.voice,
            speed=1.0,
            split_pattern=r'\n+'
        )
        
        # Combine chunks if it returns multiple
        audio_chunks = []
        sample_rate = 24000
        for i, (gs, ps, audio) in enumerate(generator):
            audio_chunks.append(audio)
            
        if not audio_chunks:
             raise HTTPException(status_code=500, detail="Failed to generate audio")
             
        # Concatenate audio
        full_audio = torch.cat(audio_chunks) if len(audio_chunks) > 1 else audio_chunks[0]
        
        # Save to buffer in WAV format (Kokoro outputs raw float arrays, easy to save to WAV)
        # However, the JS client expects MP3 by default. 
        # soundfile can write OGG/WAV. Since the JS uses buffer directly, let's return WAV for now.
        buffer = io.BytesIO()
        sf.write(buffer, full_audio.numpy(), sample_rate, format='wav')
        
        return Response(content=buffer.getvalue(), media_type="audio/wav")
        
    except Exception as e:
        print(f"Error generating audio: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    # 8880 is the port expected by the NextJS client locally
    uvicorn.run(app, host="0.0.0.0", port=8880)
