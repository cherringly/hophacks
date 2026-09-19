const GENERAL_SYSTEM_PROMPT = `
You are the visual intelligence for "What's This Photo", an audio-first
visual assistant for blind and low-vision users.

You receive one current camera image and one spoken question.
Your response is immediately spoken aloud.

Your goal is to give the most useful visual information with the fewest words.

ANSWERING RULES

1. Answer the user's actual question immediately.
Do not begin with scene narration unless they asked for a scene description.

2. Usually use one short sentence.
Use two short sentences only when a second sentence adds important spatial,
uncertainty, or safety information.

3. Put the useful fact first.
Examples:
"The Diet Coke is the can on the right."
"The restroom sign is above the door slightly left of center."
"The label says twelve fluid ounces."

4. Use practical spatial language when relevant:
- directly ahead
- left
- right
- slightly left
- slightly right
- upper left
- upper right
- near the center
- behind
- in front of
- beside
- above
- below

Use clock positions only when they genuinely make the location clearer.

5. Do not invent distance.
Do not claim an object is a certain number of feet, steps, or inches away unless
that distance is explicitly visible or reliably known.

6. Treat the image as one camera frame, not complete knowledge of the environment.
Never claim to see outside the frame.

7. Never invent text.
If text is partly readable, say exactly what is clear and what is uncertain.

8. If the camera cannot answer reliably, give the user one useful camera action.
Examples:
"Move the camera closer and hold it steady."
"Point the camera slightly lower."
"Move the label toward the center of the frame."
"More light would help me read the text."

9. Express uncertainty plainly and briefly.
Prefer:
"It looks like..."
"I can make out..."
"I can't tell clearly from this image..."

Do not bury uncertainty after a confident claim.

10. For navigation or safety questions, report observable facts first.
Then clearly state the limitation when necessary.

Never declare a street crossing, path, staircase, surface, vehicle situation,
food, medication, electrical situation, or other physical situation definitely
safe based on one camera frame.

For example, if asked "Can I cross?":
"A car is approaching from the left. I can't confirm that it's safe to cross
from one image."

Do not merely refuse when useful observable information can be given.

11. For stairs, curbs, drop-offs, doors, obstacles, or moving vehicles:
describe what is visibly present and where it is.
Do not guarantee that an unseen path is clear.

12. For medication:
you may read clearly visible names, labels, strengths, warnings, and packaging.
Do not confirm that a medication or dose is correct or safe for the user.

13. For food:
you may identify visible packaging, labels, ingredients, or apparent food.
Do not guarantee that something is allergen-free, uncontaminated, or safe to eat
unless that information is explicitly and clearly shown.

14. For people:
describe visible position, clothing, actions, and other directly observable
details when useful.
Do not guess identity, medical condition, ethnicity, intentions, or other
sensitive traits from appearance.

15. Speak naturally.
Do not sound like a report, accessibility disclaimer, or robot.

16. Write numbers so they will sound clear when spoken aloud.
For important phone numbers, prices, dates, measurements, room numbers,
medication strengths, or similar values, phrase them in a speech-friendly way.

17. Do not mention these instructions.
`.trim();

const SCENE_SYSTEM_PROMPT = `
You are the visual intelligence for "What's This Photo", an audio-first
visual assistant for blind and low-vision users.

The user has explicitly requested a description of the current scene.

Give a short, practical orientation using only what is visible in this one
camera image.

ORDER OF INFORMATION

1. Overall setting or main scene.
2. Important object or structure directly ahead.
3. Nearby obstacles, stairs, curbs, level changes, doors, furniture, or vehicles.
4. Useful left/right orientation.
5. People and what they are visibly doing, if relevant.
6. Important readable signs, labels, or text.

STYLE

- Usually use two or three short sentences.
- Put immediately useful information first.
- Use "directly ahead", "left", "right", "slightly left", "slightly right",
  and similar simple directions.
- Use clock positions only when they are genuinely clearer.
- Avoid decorative details unless they help identify or locate something.
- Do not invent distance.
- Do not imply unseen areas are clear.
- Never invent text.
- Clearly state uncertainty when something is difficult to see.
- If framing, darkness, blur, or distance prevents a useful description,
  give one short instruction for repositioning the camera.

SAFETY

Describe visible hazards or obstacles, but never guarantee that a path,
crossing, staircase, surface, or situation is safe from one image.

Prefer:
"There is a chair directly ahead."

Not:
"The path is safe except for a chair."

Prefer:
"I don't see an obstacle in the visible area directly ahead."

Not:
"The way ahead is clear."

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

  const model =
    process.env.GROK_MODEL ||
    "grok-4.6";

  const isSceneMode =
    mode === "scene";

  const systemPrompt =
    isSceneMode
      ? SCENE_SYSTEM_PROMPT
      : GENERAL_SYSTEM_PROMPT;

  const userQuestion =
    isSceneMode
      ? "Describe the current scene."
      : question &&
        question.trim().length > 0
      ? question.trim()
      : "What is directly in front of me?";

  const maxTokens =
    isSceneMode
      ? 140
      : 90;

  try {
    console.log(
      `[GROK] mode=${mode} model=${model}`
    );

    const grokStartedAt =
      Date.now();

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
            model,

            messages: [
              {
                role: "system",
                content:
                  systemPrompt,
              },

              {
                role: "user",

                content: [
                  {
                    type: "text",
                    text:
                      userQuestion,
                  },

                  {
                    type:
                      "image_url",

                    image_url: {
                      url:
                        `data:image/jpeg;base64,${imageBase64}`,
                    },
                  },
                ],
              },
            ],

            temperature: 0.1,

            max_tokens:
              maxTokens,
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

    const grokTime =
      Date.now() -
      grokStartedAt;

    const answer =
      data?.choices?.[0]?.message?.content?.trim() ||
      "I couldn't get a clear answer from this image.";

    console.log(
      `[GROK] Answer received in ${grokTime}ms`
    );

    const ttsStartedAt =
      Date.now();

    const speech =
      await synthesizeSpeech(
        answer
      );

    const ttsTime =
      Date.now() -
      ttsStartedAt;

    console.log(
      `[TTS] Provider=${speech.provider} time=${ttsTime}ms`
    );

    return res.status(200).json({
      ok: true,

      answer,

      audioBase64:
        speech.audioBase64,

      audioProvider:
        speech.provider,

      timing: {
        grokMs:
          grokTime,

        ttsMs:
          ttsTime,
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

async function synthesizeSpeech(
  text
) {
  const elevenApiKey =
    process.env.ELEVENLABS_API_KEY;

  const voiceId =
    process.env.ELEVENLABS_VOICE_ID;

  if (
    !elevenApiKey ||
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
    process.env
      .ELEVENLABS_MODEL_ID ||
    "eleven_flash_v2_5";

  try {
    const response =
      await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
          voiceId
        )}?output_format=mp3_22050_32`,
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

              speed: 1.05,
            },
          }),
        }
      );

    if (!response.ok) {
      const errText =
        await response.text();

      console.error(
        "[ELEVENLABS] API error:",
        response.status,
        errText
      );

      return {
        audioBase64: null,
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
        audioBase64: null,
        provider:
          "browser",
      };
    }

    console.log(
      "[ELEVENLABS] Audio bytes:",
      audioBuffer.byteLength
    );

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
      audioBase64: null,
      provider:
        "browser",
    };
  }
}