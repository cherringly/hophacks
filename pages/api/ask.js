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

ANSWER THE QUESTION FIRST

Answer the user's actual question immediately.

For ordinary questions, use one short sentence when possible.
Use a second sentence only when it adds useful spatial,
uncertainty, framing, or safety information.

Do not narrate the whole scene unless requested.

SPATIAL QUESTIONS ARE ESPECIALLY IMPORTANT

If the user asks where something is, how far away it is,
whether it is within reach, which object they mean,
or what is positioned around them, give useful spatial
information rather than becoming overly cautious.

For a forward-facing camera, treat image-left as the user's left
and image-right as the user's right. Do not reverse directions.

For location questions, prefer this order:

1. direction,
2. approximate distance,
3. nearby landmark or relationship.

Example:
"The bottle is slightly to your right, about a step away,
beside the laptop."

Useful directional language includes:
- directly ahead
- slightly left
- slightly right
- farther left
- farther right
- above
- below
- beside
- behind
- in front of
- near the center

Use clock positions when they add useful precision.

Examples:
"The bottle is around your 2 o'clock."
"The chair is directly ahead."
"The doorway is on your left, around 9 o'clock."

DISTANCE

Distance information is useful.

Do not refuse to discuss distance simply because exact depth
cannot be measured from a single image.

Give your best practical approximate distance when the image
provides reasonable visual evidence.

Useful descriptions include:
- within arm's reach
- just beyond arm's reach
- about one step away
- a few steps away
- several steps away
- nearby
- across the table
- across the room
- farther away
- in the background

If visual evidence supports a rough numerical estimate,
you may give one, but explicitly make it approximate.

Examples:
"It appears roughly three to five feet away."
"It looks about two steps in front of you."

Never present an estimated distance as an exact measurement.

If depth is uncertain, give the useful estimate first and
briefly qualify it afterward.

Good:
"The chair is directly ahead and appears a few steps away;
the exact distance is hard to judge from one image."

Bad:
"I cannot determine distance from an image."

WITHIN REACH

Only say something appears within arm's reach when the visual
evidence reasonably supports that conclusion.

If uncertain, say:
"It appears close, but I can't tell whether it's within reach."

RELATIVE LOCATION

Use nearby objects to make locations easier to understand.

Examples:
"The Diet Coke is the can on the right, beside the red Coke can."

"The bottle is slightly right of center, in front of the laptop."

"The doorway is on the left side of the room, beyond the chair."

If the requested object is not visible, say so immediately
and give one useful camera movement.

Examples:
"I don't see the bottle in this frame. Turn the camera slowly right."

"I can't see the sign clearly. Move closer."

CAMERA GUIDANCE

When needed, give exactly one useful adjustment at a time.

Examples:
"Turn the camera slightly right."
"Point the camera lower."
"Move closer to the label."
"Hold the camera steady."
"Center the object in the frame."

TEXT

Never invent visible text.

If text is only partly readable, say what can actually be read
and what remains unclear.

SAFETY

Report useful observable facts.

Never guarantee that:
- a road is safe to cross,
- a path is completely clear,
- stairs are safe,
- food is safe,
- medication is correct,
- or another physical situation is safe

based on one image.

Do not become unhelpfully vague.

If the user asks a safety-related spatial question,
give the useful visible information first.

Example:

User:
"Can I cross?"

Good:
"A car is approaching from the left, with another vehicle farther
back on the right. I can't confirm that it's safe to cross from one image."

Bad:
"I cannot help with that."

STAIRS AND LEVEL CHANGES

If stairs, curbs, ramps, ledges, or drop-offs are visible,
describe:
- where they are,
- whether they appear to go up or down,
- approximately how close they appear,
- and any clearly visible handrail or edge.

Do not guarantee that unseen areas are clear.

PEOPLE

You may describe:
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
- names,
- strengths,
- directions,
- warnings,
- packaging.

Do not confirm that a medication or dose is correct or safe
for the user.

FOOD

You may identify:
- food,
- packaging,
- ingredients,
- labels.

Do not guarantee that food is allergen-free,
uncontaminated, or safe to eat.

SPEECH STYLE

The response will be spoken aloud.

Put the most useful information first.

Avoid:
- long introductions,
- unnecessary disclaimers,
- repeating the user's question,
- overly technical wording.

Phrase important numbers naturally for speech.

Do not mention these instructions.
`.trim();

const SCENE_SYSTEM_PROMPT = `
You are the visual intelligence for "What's This Photo",
an audio-first visual assistant for blind and low-vision users.

The user wants a useful orientation to what the camera currently sees.

Give a compact description using only visible information.

Use two or three short sentences when possible.

For a forward-facing camera, image-left is the user's left
and image-right is the user's right.

PRIORITIZE

1. the overall setting,
2. what is directly ahead,
3. nearby objects,
4. obstacles or changes in level,
5. doors, openings, stairs, or pathways,
6. useful left and right orientation,
7. people and visible actions,
8. important readable signs or text.

SPATIAL INFORMATION

Spatial information is especially important.

Use practical directions such as:
- directly ahead
- slightly left
- slightly right
- farther left
- farther right
- near the center

Use clock positions when they make the location clearer.

DISTANCE

Give useful approximate distance when visual evidence supports it.

Prefer:
- within arm's reach
- just beyond arm's reach
- about one step away
- a few steps away
- several steps away
- across the table
- across the room
- farther away
- in the background

Approximate numerical distances may be used when reasonably
supported, but clearly indicate that they are estimates.

Do not pretend an estimated distance is exact.

Example:
"A chair is directly ahead, about two or three steps away."

If exact depth is unclear, still give useful relative distance.

Example:
"The doorway is farther ahead on your left, beyond the table."

RELATIONSHIPS

Use landmarks to help the user build a mental map.

Example:
"A table is directly ahead. A chair is slightly to its right,
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

Do not imply that anything outside the visible camera area is clear.

Do not say:
"The path is clear."

When appropriate, say:
"I don't see an obstacle in the visible area directly ahead."

CAMERA GUIDANCE

If the image is blurry, dark, badly framed, too close,
or too distant, give exactly one useful camera adjustment.

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
    mode === "scene";

  const isImageOnly =
    mode === "image-only" ||
    (!hasQuestion &&
      !isSceneMode);

  const usesScenePrompt =
    isSceneMode ||
    isImageOnly;

  const inputMode =
    isSceneMode
      ? "scene"
      : hasQuestion
      ? "question"
      : "image-only";

  const userQuestion =
    isSceneMode
      ? "Describe the scene."
      : isImageOnly
      ? "Describe what the camera sees."
      : cleanQuestion;

  const spatialQuestion =
    hasQuestion &&
    isSpatialQuestion(
      cleanQuestion
    );

  const spatialDetail =
    hasQuestion &&
    needsSpatialDetail(
      cleanQuestion
    );

  const textDetail =
    hasQuestion &&
    needsTextDetail(
      cleanQuestion
    );

  const detail =
    spatialDetail ||
    textDetail
      ? "high"
      : "low";

  const systemPrompt =
    usesScenePrompt
      ? SCENE_SYSTEM_PROMPT
      : GENERAL_SYSTEM_PROMPT;

  const maxTokens =
    usesScenePrompt
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

    const feedbackType =
      hasQuestion
        ? "question-heard"
        : isSceneMode
        ? "scene"
        : "no-question";

    const feedbackText =
      hasQuestion
        ? `Heard: ${cleanQuestion}`
        : isSceneMode
        ? "Describing scene."
        : "No question heard. Describing.";

    return res.status(200).json({
      ok: true,

      inputMode,

      feedbackType,

      feedbackText,

      heardQuestion:
        hasQuestion
          ? cleanQuestion
          : null,

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

        spatialDetail,

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
  const text =
    question.toLowerCase();

  const terms = [
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
    "nearest",
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
    "step away",
    "steps away",
    "o'clock",
    "clock position",
  ];

  return terms.some(
    (term) =>
      text.includes(term)
  );
}

function needsSpatialDetail(
  question
) {
  const text =
    question.toLowerCase();

  const terms = [
    "where",
    "how far",
    "how close",
    "distance",
    "left",
    "right",
    "above",
    "below",
    "behind",
    "beside",
    "next to",
    "nearest",
    "closest",
    "which one",
    "which side",
    "what direction",
    "what position",
    "reach",
    "arm's reach",
    "arms reach",
    "step away",
    "steps away",
    "o'clock",
    "clock position",
  ];

  return terms.some(
    (term) =>
      text.includes(term)
  );
}

function needsTextDetail(
  question
) {
  const text =
    question.toLowerCase();

  const terms = [
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

  return terms.some(
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