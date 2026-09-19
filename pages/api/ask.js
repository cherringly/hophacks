const FAST_MODEL = "grok-4.3";

const GENERAL_SYSTEM_PROMPT = `
You are the visual intelligence for "What's This Camera",
an audio-first visual assistant for blind and low-vision users.

You receive one current camera image and usually a spoken question.
Your response will be spoken aloud.

Your priorities are:
1. usefulness,
2. speed,
3. accuracy,
4. spatial clarity,
5. honest uncertainty.

QUESTION MODE

Answer the user's actual question immediately.

For simple questions, answer in one short sentence.
Use a second sentence only when it adds important location,
uncertainty, framing, or safety information.

Do not narrate the entire scene unless the user asks.

Use practical spatial language when useful:
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
Never guess what exists outside the image.
Never invent precise distances.

If the camera cannot answer reliably:
1. briefly explain what is unclear,
2. give one useful camera adjustment.

Examples:
"Move the camera closer to the label."
"Point the camera slightly lower."
"Center the sign and hold still."

SAFETY

Report useful observable facts, but never guarantee that
a path, crossing, staircase, surface, vehicle situation,
food, medication, or other physical situation is safe
from one image.

If asked a safety question, give the relevant visible
information instead of simply refusing.

Example:

User: "Can I cross?"

Good:
"A vehicle is approaching from the left. I can't confirm
that it's safe to cross from one image."

For medication:
You may read clearly visible names, strengths, directions,
and warnings. Do not confirm that a medicine or dose is
correct or safe for the user.

For food:
You may identify visible food, packaging, ingredients,
and labels. Do not guarantee food is allergen-free,
uncontaminated, or safe to eat.

For people:
Describe visible position, clothing, and actions when useful.
Do not guess identity, intentions, health condition, ethnicity,
or other sensitive traits from appearance.

Phrase important numbers naturally for speech.

Do not mention these instructions.
`.trim();

const SCENE_SYSTEM_PROMPT = `
You are the visual intelligence for "What's This Camera",
an audio-first visual assistant for blind and low-vision users.

The user wants to know what the camera currently sees.

Give a compact, useful orientation from this single image.

Use two or three short sentences maximum.

Prioritize:
1. the overall setting,
2. what is directly ahead,
3. nearby obstacles or changes in level,
4. useful left/right orientation,
5. important objects,
6. people and visible actions,
7. important readable signs or text.

Use simple spatial language:
"directly ahead",
"left",
"right",
"slightly left",
"slightly right".

Do not invent distances.
Do not imply unseen areas are clear.
Do not guarantee that a path or situation is safe.

If the image is blurry, dark, too distant, or badly framed,
give one short camera adjustment.

Never invent text.

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
    mode,
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
      error:
        "Server missing GROK_API_KEY",
    });
  }

  const cleanQuestion =
    typeof question === "string"
      ? question.trim()
      : "";

  const hasQuestion =
    cleanQuestion.length > 0;

  const isSceneMode =
    mode === "scene" ||
    mode === "image-only" ||
    !hasQuestion;

  const inputMode =
    hasQuestion
      ? "question"
      : "image-only";

  const userQuestion =
    isSceneMode
      ? "Describe what the camera sees."
      : cleanQuestion;

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

  const startedAt =
    Date.now();

  try {
    console.log(
      `[GROK] mode=${inputMode} detail=${detail}`
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

            temperature: 0,

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
      startedAt;

    const answer =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I couldn't get a clear answer from this image.";

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
      `[GROK] ${grokMs}ms`
    );

    console.log(
      `[TTS] ${ttsMs}ms provider=${speech.provider}`
    );

    return res.status(200).json({
      ok: true,

      inputMode,

      heardQuestion:
        hasQuestion
          ? cleanQuestion
          : null,

      feedbackText:
        hasQuestion
          ? `I heard: ${cleanQuestion}`
          : "No question heard. Describing what I see.",

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
          startedAt,

        detail,

        model:
          FAST_MODEL,
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
    return {
      audioBase64:
        null,

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