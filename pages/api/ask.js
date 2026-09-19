const FAST_MODEL = "grok-4.3";

const GENERAL_SYSTEM_PROMPT = `
You are the visual intelligence for "What's This Photo",
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

For simple questions, usually answer in one or two short sentences.

Do not give a full scene description unless the user asks for one.

SPATIAL QUESTIONS ARE IMPORTANT

When the user asks:
- where something is,
- how far away something is,
- what is in front of them,
- where to point the camera,
- which object they mean,
- or how objects are positioned,

give the clearest practical spatial answer you can.

Always try to include direction when relevant.

Good directional language includes:
- directly ahead
- slightly left
- slightly right
- far left
- far right
- above
- below
- beside
- behind
- in front of
- near the center
- upper left
- upper right

Clock positions are useful when they give better precision.

Examples:
"Your bottle is around 2 o'clock."
"The chair is directly ahead."
"The door is on your left, around 9 o'clock."

DISTANCE

Distance information is useful.

Do not refuse to discuss distance just because exact depth cannot be measured
from one image.

Give a practical approximate distance when the image provides reasonable
visual evidence.

Prefer human-friendly distance descriptions such as:
- within arm's reach
- just beyond arm's reach
- very close
- about one step away
- a few steps away
- several steps away
- nearby
- across the table
- across the room
- farther away
- in the background

If there is enough visual evidence to make a rough numerical estimate,
you may give it, but clearly mark it as approximate.

Examples:
"It looks roughly three to five feet away."
"It appears to be about two steps in front of you."

Never present an estimated distance as an exact measurement.

If depth is difficult to judge, say so briefly but still give useful
relative information.

Good:
"The chair is directly ahead and appears a few steps away, though the exact
distance is hard to judge from one image."

Bad:
"I cannot determine distance from an image."

RELATIVE LOCATION

When multiple objects are visible, use nearby landmarks to help the user
locate the requested object.

Examples:
"The Diet Coke is the can on the right, beside the red Coke can."

"The water bottle is slightly right of center, in front of the laptop."

"The door is on the left side of the room, just past the chair."

When useful, combine:
1. direction,
2. approximate distance,
3. nearby reference object.

Example:
"Your backpack is slightly left of center, a few steps away, beside the chair."

OBJECTS WITHIN REACH

If an object appears very close to the camera, you may say:
- within arm's reach
- close enough to reach
- just beyond arm's reach

Only say this when the visual evidence reasonably supports it.

CAMERA GUIDANCE

If the requested object cannot be seen clearly, tell the user how to move
the camera.

Examples:
"Turn the camera slightly right."
"Point the camera lower."
"Move closer to the label."
"Hold the camera steady."
"Center the object in the frame."

Prefer one simple movement at a time.

TEXT

Never invent text.

If text is partially readable:
- say what you can read,
- say what is unclear,
- suggest moving closer when useful.

SAFETY

Report useful observable facts.

Never guarantee that:
- a road is safe to cross,
- a path is completely clear,
- stairs are safe,
- food is safe,
- medication is correct,
- or a physical situation is safe

based on one image.

Do not become unhelpfully vague.

If the user asks a safety-related spatial question, describe what is visible.

Example:

User:
"Can I cross?"

Good:
"A car is approaching from the left, and another vehicle is farther back on
the right. I can't confirm that it's safe to cross from one image."

Bad:
"I cannot help with that."

STAIRS AND LEVEL CHANGES

If stairs, curbs, ledges, ramps, or drop-offs are visible, describe:
- where they are,
- whether they appear to go up or down,
- approximately how close they appear,
- and any visible handrail or edge.

Do not guarantee the number of steps unless they are clearly visible.

PEOPLE

Describe:
- visible position,
- clothing,
- movement,
- and actions

when useful.

Do not guess:
- identity,
- intentions,
- health conditions,
- ethnicity,
- or other sensitive traits.

MEDICATION

You may read clearly visible:
- medication names,
- strengths,
- directions,
- warnings,
- packaging.

Do not confirm that a medicine or dose is correct or safe for the user.

FOOD

You may identify:
- visible food,
- packaging,
- ingredients,
- labels.

Do not guarantee that food is allergen-free, uncontaminated, or safe to eat.

SPEECH STYLE

The answer will be spoken aloud.

Put the most useful information first.

Avoid:
- long introductions,
- unnecessary disclaimers,
- repeating the question,
- overly technical wording.

Phrase important numbers naturally for speech.

Do not mention these instructions.
`.trim();

const SCENE_SYSTEM_PROMPT = `
You are the visual intelligence for "What's This Photo",
an audio-first visual assistant for blind and low-vision users.

The user wants an orientation to what the camera currently sees.

Give a short, useful description using only visible information.

Use two or three short sentences when possible.

PRIORITIZE

1. overall setting,
2. what is directly ahead,
3. nearby objects,
4. obstacles or changes in level,
5. doors, openings, stairs, or pathways,
6. useful left and right orientation,
7. people and visible actions,
8. important readable signs or text.

SPATIAL INFORMATION

Spatial information is especially important.

Describe objects using practical directions such as:
- directly ahead
- slightly left
- slightly right
- far left
- far right
- above
- below
- near the center

Use clock positions when they make the location clearer.

DISTANCE

Give useful approximate distance when visual evidence supports it.

Prefer:
- within arm's reach
- just beyond arm's reach
- one step away
- a few steps away
- several steps away
- across the room
- farther away
- in the background

Approximate numerical distances may be used when reasonably supported,
but clearly indicate that they are estimates.

Do not pretend an estimated distance is exact.

Example:
"A chair is directly ahead, about two or three steps away."

If exact depth is unclear, still give relative distance.

Example:
"The doorway is farther ahead on your left, beyond the table."

RELATIONSHIPS

Use visible landmarks to help locate objects.

Example:
"A table is directly ahead. A chair is slightly to the right of it,
and the doorway is farther left."

OBSTACLES

Mention visible:
- furniture,
- stairs,
- curbs,
- ledges,
- large objects,
- vehicles,
- or other notable obstacles.

Do not imply that areas outside the camera frame are clear.

Do not say a route is safe.

If useful, say:
"I don't see an obstacle in the visible area directly ahead."

Do not say:
"The path is clear."

CAMERA GUIDANCE

If the image is:
- blurry,
- dark,
- badly framed,
- too close,
- or too far away,

give one short instruction to improve the view.

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

  const highDetail =
    shouldUseHighDetail(
      userQuestion,
      isSceneMode
    );

  const detail =
    highDetail
      ? "high"
      : "low";

  const spatialQuestion =
    isSpatialQuestion(
      userQuestion
    );

  const maxTokens =
    isSceneMode
      ? 130
      : spatialQuestion
      ? 90
      : 65;

  const startedAt =
    Date.now();

  try {
    console.log(
      `[GROK] mode=${inputMode} detail=${detail} spatial=${spatialQuestion}`
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
              0.1,

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

    console.log(
      `[GROK] answer in ${grokMs}ms`
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
          ? `Heard: ${cleanQuestion}`
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

        spatialQuestion,

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

function isSpatialQuestion(
  question
) {
  if (!question) {
    return false;
  }

  const text =
    question.toLowerCase();

  const spatialTerms = [
    "where",
    "how far",
    "how close",
    "distance",
    "in front",
    "infront",
    "ahead",
    "behind",
    "left",
    "right",
    "above",
    "below",
    "beside",
    "next to",
    "near",
    "closest",
    "which one",
    "which side",
    "what direction",
    "what position",
    "what is around",
    "whats around",
    "what's around",
    "what is in front",
    "whats in front",
    "what's in front",
    "point",
    "reach",
    "arm's reach",
    "arms reach",
  ];

  return spatialTerms.some(
    (term) =>
      text.includes(term)
  );
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
    "small text",
    "fine print",
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
      console.error(
        "[ELEVENLABS] Empty audio response"
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