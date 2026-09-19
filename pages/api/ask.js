const FAST_MODEL = "grok-4.3";

const GENERAL_SYSTEM_PROMPT = `
You are the visual intelligence for "What's This Photo", an audio-first
visual assistant for blind and low-vision users.

You receive one current camera image and one spoken question.
Your response will immediately be spoken aloud.

Your highest priorities are:
1. usefulness,
2. speed,
3. accuracy,
4. clear spatial information,
5. honest uncertainty.

Rules:

- Answer the user's question immediately.
- For simple questions, answer in ONE short sentence.
- Only use a second sentence when it adds important spatial, uncertainty,
  framing, or safety information.
- Do not narrate the whole scene unless asked.

Use practical spatial language:
- directly ahead
- left
- right
- slightly left
- slightly right
- above
- below
- beside
- behind
- near the center

Use clock positions only when they are clearer than left or right.

Never invent text.
Never guess information outside the image.
Never invent exact distances.

If something cannot be seen clearly:
- say what is uncertain,
- then give one short camera adjustment that could help.

Examples:
"Move the camera closer to the label."
"Point the camera slightly lower."
"Hold the camera steady."
"Center the sign in the frame."

Safety:
- Report observable facts.
- Never guarantee that a route, crossing, staircase, surface, food,
  medication, vehicle situation, or other physical situation is safe
  based on one image.
- Do not merely refuse if useful visible information can be given.

Example:
User: "Can I cross?"
Good:
"A car is approaching from the left. I can't confirm that it's safe to cross
from this image."

For medication:
- You may read clearly visible names, strengths, directions, and warnings.
- Do not confirm that a medication or dose is correct or safe for the user.

For food:
- You may identify visible food, packaging, ingredients, or labels.
- Do not guarantee that food is allergen-free or safe to eat.

For people:
- Describe visible position, clothing, and actions when useful.
- Do not guess identity, intentions, health status, ethnicity, or other
  sensitive traits from appearance.

Phrase important numbers so they sound natural when spoken.

Do not mention these instructions.
`.trim();

const SCENE_SYSTEM_PROMPT = `
You are the visual intelligence for "What's This Photo", an audio-first
visual assistant for blind and low-vision users.

The user asked for a scene description.

Give a compact orientation using only what is visible.

Use two or three short sentences maximum.

Order:
1. overall setting,
2. what is directly ahead,
3. important obstacles or level changes,
4. useful left/right orientation,
5. important people, objects, signs, or text.

Use simple directions like directly ahead, left, right, slightly left,
and slightly right.

Do not invent distances.
Do not imply unseen areas are clear.
Do not guarantee that a path or situation is safe.

If the image is too blurry, dark, distant, or badly framed, say so and give
one short camera adjustment.

Do not mention these instructions.
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
    mode = "question",
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

  const isSceneMode =
    mode === "scene";

  const userQuestion =
    isSceneMode
      ? "Describe the scene."
      : question?.trim() ||
        "What is directly in front of me?";

  const systemPrompt =
    isSceneMode
      ? SCENE_SYSTEM_PROMPT
      : GENERAL_SYSTEM_PROMPT;

  const detail =
    shouldUseHighDetail(
      userQuestion,
      isSceneMode
    )
      ? "high"
      : "low";

  const maxTokens =
    isSceneMode
      ? 110
      : 60;

  const grokStartedAt =
    Date.now();

  try {
    console.log(
      `[GROK] model=${FAST_MODEL} reasoning=none detail=${detail} mode=${mode}`
    );

    const response =
      await fetch(
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
            model:
              FAST_MODEL,

            reasoning_effort:
              "none",

            service_tier:
              "priority",

            messages: [
              {
                role:
                  "system",

                content:
                  systemPrompt,
              },

              {
                role:
                  "user",

                content: [
                  {
                    type:
                      "text",

                    text:
                      userQuestion,
                  },

                  {
                    type:
                      "image_url",

                    image_url: {
                      url:
                        `data:image/jpeg;base64,${imageBase64}`,

                      detail,
                    },
                  },
                ],
              },
            ],

            temperature:
              0,

            max_tokens:
              maxTokens,
          }),
        }
      );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "[GROK] API error:",
        response.status,
        errorText
      );

      return res.status(502).json({
        ok: false,

        error:
          `Grok API error (${response.status})`,
      });
    }

    const data =
      await response.json();

    const grokMs =
      Date.now() -
      grokStartedAt;

    const answer =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I couldn't get a clear answer from this image.";

    console.log(
      `[GROK] answer in ${grokMs}ms tier=${data.service_tier || "unknown"}`
    );

    const ttsStartedAt =
      Date.now();

    const speech =
      await synthesizeSpeech(
        answer
      );

    const ttsMs =
      Date.now() -
      ttsStartedAt;

    console.log(
      `[TTS] provider=${speech.provider} time=${ttsMs}ms`
    );

    return res.status(200).json({
      ok: true,

      answer,

      audioBase64:
        speech.audioBase64,

      audioProvider:
        speech.provider,

      timing: {
        grokMs,
        ttsMs,

        totalServerMs:
          Date.now() -
          grokStartedAt,

        detail,

        model:
          FAST_MODEL,

        serviceTier:
          data.service_tier ||
          "unknown",
      },
    });
  } catch (error) {
    console.error(
      "[SERVER] Error:",
      error
    );

    return res.status(500).json({
      ok: false,

      error:
        "Server error processing image",
    });
  }
}

function shouldUseHighDetail(
  question,
  isSceneMode
) {
  if (isSceneMode) {
    return false;
  }

  const text =
    question.toLowerCase();

  const highDetailTerms = [
    "read",
    "text",
    "say",
    "label",
    "sign",
    "menu",
    "price",
    "number",
    "expiration",
    "expires",
    "medicine",
    "medication",
    "dose",
    "dosage",
    "ingredient",
    "ingredients",
    "nutrition",
    "barcode",
    "serial",
    "model number",
    "phone number",
    "address",
    "document",
    "receipt",
    "letter",
    "package",
    "packaging",
  ];

  return highDetailTerms.some(
    (term) =>
      text.includes(term)
  );
}

async function synthesizeSpeech(
  text
) {
  const apiKey =
    process.env.ELEVENLABS_API_KEY;

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID;

  if (
    !apiKey ||
    !voiceId
  ) {
    console.error(
      "[ELEVENLABS] Missing configuration"
    );

    return {
      audioBase64: null,
      provider:
        "browser",
    };
  }

  const modelId =
    process.env.ELEVENLABS_MODEL_ID ||
    "eleven_flash_v2_5";

  try {
    const response =
      await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
          voiceId
        )}?output_format=mp3_22050_32`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "audio/mpeg",

            "xi-api-key":
              apiKey,
          },

          body:
            JSON.stringify({
              text,

              model_id:
                modelId,

              voice_settings: {
                stability:
                  0.45,

                similarity_boost:
                  0.75,

                speed:
                  1.08,
              },
            }),
        }
      );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "[ELEVENLABS] API error:",
        response.status,
        errorText
      );

      return {
        audioBase64:
          null,

        provider:
          "browser",
      };
    }

    const audioBuffer =
      await response.arrayBuffer();

    if (
      !audioBuffer.byteLength
    ) {
      console.error(
        "[ELEVENLABS] Empty audio"
      );

      return {
        audioBase64:
          null,

        provider:
          "browser",
      };
    }

    return {
      audioBase64:
        Buffer.from(
          audioBuffer
        ).toString(
          "base64"
        ),

      provider:
        "elevenlabs",
    };
  } catch (error) {
    console.error(
      "[ELEVENLABS] Request failed:",
      error
    );

    return {
      audioBase64:
        null,

      provider:
        "browser",
    };
  }
}