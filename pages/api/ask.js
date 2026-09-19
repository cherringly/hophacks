export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { question, imageBase64 } = req.body || {};

  if (!imageBase64) {
    return res.status(400).json({ error: "Missing imageBase64" });
  }

  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server missing GROK_API_KEY" });
  }

  const model = process.env.GROK_MODEL || "grok-4.5";
  const userQuestion = question && question.trim().length > 0
    ? question
    : "What is in front of me and how do I navigate safely?";

  const systemPrompt =
    "You are a real-time navigation assistant for a person who is blind or " +
    "low-vision. You receive one photo taken from their phone camera and a " +
    "spoken question. Respond with ONE short spoken-style sentence (max ~20 " +
    "words): clear, concrete, and immediately actionable. Use distance " +
    "estimates (e.g. 'about 10 feet') and clock-position or left/right " +
    "directions. Do not describe the whole scene, only answer the question. " +
    "If you truly cannot tell from the photo, say so in one short sentence " +
    "and suggest turning or moving the camera.";

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userQuestion },
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 120,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Grok API error:", response.status, errText);
      return res
        .status(502)
        .json({ error: `Grok API error (${response.status})`, detail: errText });
    }

    const data = await response.json();
    const answer =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I couldn't get a clear answer that time.";

    const audioBase64 = await synthesizeSpeech(answer);

    return res.status(200).json({ answer, audioBase64 });
  } catch (err) {
    console.error("Server error calling Grok:", err);
    return res.status(500).json({ error: "Server error calling Grok" });
  }
}

// Calls ElevenLabs to turn the answer text into speech. Returns base64 mp3
// audio, or null if ElevenLabs isn't configured or the request fails (the
// caller falls back to the browser's built-in speech synthesis in that case).
async function synthesizeSpeech(text) {
  const elevenApiKey = process.env.ELEVENLABS_API_KEY;
  if (!elevenApiKey) return null;

  // Default is ElevenLabs' premade "Rachel" voice. Override with your own
  // voice ID (from elevenlabs.io/app/voice-library) via ELEVENLABS_VOICE_ID.
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

  try {
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      console.error("ElevenLabs API error:", ttsResponse.status, errText);
      return null;
    }

    const ttsData = await ttsResponse.json();
    return ttsData.audio_base64 || null;
  } catch (err) {
    console.error("Server error calling ElevenLabs:", err);
    return null;
  }
}