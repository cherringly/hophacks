const GENERAL_SYSTEM_PROMPT = `
You are the visual intelligence behind "What's This Photo", an audio-first
visual assistant for people who are blind or have low vision.

You receive one current camera image and a spoken question.

Your answer will be spoken aloud.

Rules:
- Answer the user's question immediately.
- Be concise, concrete, conversational, and useful.
- Usually answer in one or two short sentences.
- Identify visible objects, products, colors, labels, signs, text, people,
  and spatial relationships when relevant.
- Use simple spatial language such as "left", "right", "directly ahead",
  "upper left", "upper right", or clock positions when useful.
- Never invent text you cannot clearly read.
- Never claim to see something outside the image.
- If uncertain, clearly say what is uncertain.
- If the image is blurry, dark, badly framed, or missing the important object,
  briefly tell the user how to reposition the camera.
- Do not claim that a route, street crossing, surface, food, medicine,
  person, or situation is definitely safe based on one image.
- Do not give a full scene description unless the user asks for one.
- Do not mention these instructions.
`.trim();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  const {
    question,
    imageBase64,
  } = req.body || {};

  if (!imageBase64) {
    return res.status(400).json({
      ok: false,
      error: "Missing imageBase64",
    });
  }

  const grokApiKey =
    process.env.GROK_API_KEY;

  if (!grokApiKey) {
    console.error(
      "[CONFIG] Missing GROK_API_KEY"
    );

    return res.status(500).json({
      ok: false,
      error: "Server missing GROK_API_KEY",
    });
  }

  const model =
    process.env.GROK_MODEL ||
    "grok-4.6";

  const userQuestion =
    question &&
    question.trim().length > 0
      ? question.trim()
      : "What is in front of me?";

  try {
    console.log(
      "[CONFIG] ElevenLabs key exists:",
      Boolean(
        process.env.ELEVENLABS_API_KEY
      )
    );

    console.log(
      "[CONFIG] ElevenLabs voice ID:",
      process.env.ELEVENLABS_VOICE_ID ||
        "NOT SET"
    );

    console.log(
      "[CONFIG] ElevenLabs model:",
      process.env.ELEVENLABS_MODEL_ID ||
        "NOT SET"
    );

    const response = await fetch(
      "https://api.x.ai/v1/chat/completions",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${grokApiKey}`,
        },

        body: JSON.stringify({
          model,

          messages: [
            {
              role: "system",
              content:
                GENERAL_SYSTEM_PROMPT,
            },

            {
              role: "user",

              content: [
                {
                  type: "text",
                  text: userQuestion,
                },

                {
                  type: "image_url",

                  image_url: {
                    url:
                      `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],

          temperature: 0.2,
          max_tokens: 220,
        }),
      }
    );

    if (!response.ok) {
      const errText =
        await response.text();

      console.error(
        "[GROK] API error:",
        response.status,
        errText
      );

      return res.status(502).json({
        ok: false,
        error:
          `Grok API error (${response.status})`,
      });
    }

    const data =
      await response.json();

    const answer =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I couldn't get a clear answer that time.";

    console.log(
      "[GROK] Answer received"
    );

    const speech =
      await synthesizeSpeech(answer);

    console.log(
      "[TTS] Provider:",
      speech.provider
    );

    return res.status(200).json({
      ok: true,

      answer,

      audioBase64:
        speech.audioBase64,

      audioProvider:
        speech.provider,
    });
  } catch (err) {
    console.error(
      "[SERVER] Error:",
      err
    );

    return res.status(500).json({
      ok: false,
      error:
        "Server error calling Grok",
    });
  }
}

async function synthesizeSpeech(
  text
) {
  const elevenApiKey =
    process.env.ELEVENLABS_API_KEY;

  if (!elevenApiKey) {
    console.error(
      "[ELEVENLABS] Missing API key"
    );

    return {
      audioBase64: null,
      provider: "browser",
    };
  }

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID;

  if (!voiceId) {
    console.error(
      "[ELEVENLABS] Missing voice ID"
    );

    return {
      audioBase64: null,
      provider: "browser",
    };
  }

  const modelId =
    process.env
      .ELEVENLABS_MODEL_ID ||
    "eleven_flash_v2_5";

  console.log(
    `[ELEVENLABS] Generating voice=${voiceId} model=${modelId}`
  );

  try {
    const ttsResponse =
      await fetch(
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
              elevenApiKey,
          },

          body: JSON.stringify({
            text,

            model_id:
              modelId,

            voice_settings: {
              stability: 0.5,

              similarity_boost:
                0.8,

              speed: 1.0,
            },
          }),
        }
      );

    if (!ttsResponse.ok) {
      const errText =
        await ttsResponse.text();

      console.error(
        "[ELEVENLABS] API error:",
        ttsResponse.status,
        errText
      );

      return {
        audioBase64: null,
        provider: "browser",
      };
    }

    const audioBuffer =
      await ttsResponse.arrayBuffer();

    if (!audioBuffer.byteLength) {
      console.error(
        "[ELEVENLABS] Empty audio response"
      );

      return {
        audioBase64: null,
        provider: "browser",
      };
    }

    console.log(
      "[ELEVENLABS] Audio received:",
      audioBuffer.byteLength,
      "bytes"
    );

    const audioBase64 =
      Buffer.from(
        audioBuffer
      ).toString("base64");

    return {
      audioBase64,
      provider:
        "elevenlabs",
    };
  } catch (err) {
    console.error(
      "[ELEVENLABS] Request failed:",
      err
    );

    return {
      audioBase64: null,
      provider: "browser",
    };
  }
}