export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const { text } = req.body || {};

  if (!text || typeof text !== "string") {
    return res.status(400).json({
      ok: false,
      error: "Missing text",
    });
  }

  const apiKey =
    process.env.ELEVENLABS_API_KEY;

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID;

  const modelId =
    process.env.ELEVENLABS_MODEL_ID ||
    "eleven_flash_v2_5";

  if (!apiKey || !voiceId) {
    return res.status(503).json({
      ok: false,
      error: "ElevenLabs is not configured",
    });
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
        voiceId
      )}?output_format=mp3_44100_128`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
          Accept:
            "audio/mpeg",
          "xi-api-key":
            apiKey,
        },

        body: JSON.stringify({
          text,
          model_id: modelId,

          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "[SPEAK] ElevenLabs error:",
        response.status,
        errorText
      );

      return res.status(502).json({
        ok: false,
        error: "Speech generation failed",
      });
    }

    const audioBuffer =
      await response.arrayBuffer();

    const audioBase64 =
      Buffer.from(
        audioBuffer
      ).toString("base64");

    return res.status(200).json({
      ok: true,
      audioBase64,
      audioMimeType:
        "audio/mpeg",
    });
  } catch (error) {
    console.error(
      "[SPEAK] error:",
      error
    );

    return res.status(500).json({
      ok: false,
      error: "Speech generation failed",
    });
  }
}