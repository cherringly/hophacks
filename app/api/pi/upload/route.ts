// STATUS: ABLE TO RECEIVE IMAGE FROM PI

// import { put } from "@vercel/blob";

// export async function POST(request: Request) {
//   try {
//     const formData = await request.formData();
//     const file = formData.get("image");

//     if (!(file instanceof File)) {
//       return Response.json(
//         { error: "No image received" },
//         { status: 400 }
//       );
//     }

//     const timestamp = Date.now();

//     // const blob = await put(
//     //   "pi/latest.jpg",
//     //   file,
//     //   {
//     //     access: "private",
//     //     addRandomSuffix: false,
//     //   }
//     // );
//     const blob = await put("pi/latest.jpg", file, {
//       access: "private",
//       addRandomSuffix: false,
//       allowOverwrite: true,
//       contentType: "image/jpeg",
//     });

//     // Save information about the newest image
//     await put(
//       "pi/latest.json",
//       JSON.stringify({
//         url: blob.url,
//         timestamp,
//       }),
//       {
//         access: "private",
//         addRandomSuffix: false,
//         contentType: "application/json",
//       }
//     );

//     return Response.json({
//       success: true,
//       url: blob.url,
//       timestamp,
//     });

//   } catch (error) {
//     console.error("Upload error:", error);

//     return Response.json(
//       { error: "Upload failed" },
//       { status: 500 }
//     );
//   }
// }




// // STATUS: ABLE TO idk
// import { put } from "@vercel/blob";

// export async function POST(request: Request) {
//   try {
//     // Receive image from Raspberry Pi
//     const formData = await request.formData();
//     const file = formData.get("image");

//     if (!(file instanceof File)) {
//       return Response.json(
//         { error: "No image received" },
//         { status: 400 }
//       );
//     }

//     // Save image to Vercel Blob
//     await put(
//       "pi/latest.jpg",
//       file,
//       {
//         access: "private",
//         addRandomSuffix: false,
//         allowOverwrite: true,
//       }
//     );

//     // Convert image to base64 for Grok
//     const imageBuffer = await file.arrayBuffer();
//     const base64Image = Buffer.from(imageBuffer).toString("base64");

//     // Ask Grok about the image
//     const grokResponse = await fetch(
//       "https://api.x.ai/v1/responses",
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           "Authorization": `Bearer ${process.env.GROK_API_KEY}`,
//         },
//         body: JSON.stringify({
//           model: process.env.GROK_MODEL || "grok-4.6",
//           input: [
//             {
//               role: "user",
//               content: [
//                 {
//                   type: "input_image",
//                   image_url: `data:image/jpeg;base64,${base64Image}`,
//                   detail: "high",
//                 },
//                 {
//                   type: "input_text",
//                   text: `
// You are an accessibility assistant for a blind user.

// Answer this question about the image:

// "Where is the door?"

// Give a very short, useful answer.
// Describe the door's approximate direction and distance if possible.
// For example: "The door is about 15 feet ahead and slightly to your left."

// Do not describe the entire image.
// Do not mention uncertainty unless it is important.
//                   `,
//                 },
//               ],
//             },
//           ],
//         }),
//       }
//     );

//     if (!grokResponse.ok) {
//       const errorText = await grokResponse.text();
//       console.error("Grok error:", errorText);

//       return Response.json(
//         { error: "Grok analysis failed", details: errorText },
//         { status: 500 }
//       );
//     }

//     const grokData = await grokResponse.json();

//     // Extract Grok's text response
//     const answer =
//       grokData.output
//         ?.flatMap((item: any) => item.content || [])
//         ?.find((item: any) => item.type === "output_text")
//         ?.text ||
//       "I could not determine where the door is.";

//     console.log("Grok answer:", answer);

//     // Convert answer to speech
//     const ttsResponse = await fetch(
//       "https://api.x.ai/v1/tts",
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           "Authorization": `Bearer ${process.env.GROK_API_KEY}`,
//         },
//         body: JSON.stringify({
//           text: answer,
//           voice_id: "eve",
//           language: "en",
//         }),
//       }
//     );

//     if (!ttsResponse.ok) {
//       const errorText = await ttsResponse.text();
//       console.error("TTS error:", errorText);

//       return Response.json(
//         {
//           success: true,
//           answer,
//           audio: null,
//           error: "TTS failed",
//         },
//         { status: 200 }
//       );
//     }

//     const audioBuffer = await ttsResponse.arrayBuffer();

//     // Return everything to the Pi/requesting browser
//     return new Response(audioBuffer, {
//       status: 200,
//       headers: {
//         "Content-Type": "audio/mpeg",
//         "X-Grok-Answer": encodeURIComponent(answer),
//       },
//     });

//   } catch (error) {
//     console.error("Upload/analyze error:", error);

//     return Response.json(
//       { error: "Processing failed" },
//       { status: 500 }
//     );
//   }
// }


//STATUS
// import { put } from "@vercel/blob";

// export async function POST(request: Request) {
//   try {
//     // Get image from Pi
//     const formData = await request.formData();
//     const file = formData.get("image");

//     if (!(file instanceof File)) {
//       return Response.json(
//         { error: "No image received" },
//         { status: 400 }
//       );
//     }

//     // --------------------------------------------------
//     // 1. Save latest image to Vercel Blob
//     // --------------------------------------------------

//     await put("pi/latest.jpg", file, {
//       access: "private",
//       addRandomSuffix: false,
//       allowOverwrite: true,
//     });

//     // --------------------------------------------------
//     // 2. Convert image to base64 for Grok
//     // --------------------------------------------------

//     const imageBuffer = Buffer.from(await file.arrayBuffer());
//     const base64Image = imageBuffer.toString("base64");

//     // --------------------------------------------------
//     // 3. Ask Grok to analyze the image
//     // --------------------------------------------------

//     const grokResponse = await fetch("https://api.x.ai/v1/responses", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${process.env.GROK_API_KEY}`,
//       },
//       body: JSON.stringify({
//         model: process.env.GROK_MODEL || "grok-4.5",

//         input: [
//           {
//             role: "user",
//             content: [
//               {
//                 type: "input_image",
//                 image_url: `data:image/jpeg;base64,${base64Image}`,
//               },
//               {
//                 type: "input_text",
//                 text:
//                   "You are assisting a blind person navigating their surroundings. " +
//                   "Look carefully at the image and answer this question: Where is the door? " +
//                   "Give a short, clear spoken answer describing the door's direction " +
//                   "and approximate distance if that can reasonably be inferred from the image. " +
//                   "Use simple language. Do not invent details that are not visible. " +
//                   "Keep the answer to one or two sentences.",
//               },
//             ],
//           },
//         ],
//       }),
//     });

//     if (!grokResponse.ok) {
//       const errorText = await grokResponse.text();

//       console.error("Grok analysis error:", errorText);

//       return Response.json(
//         {
//           error: "Grok analysis failed",
//           details: errorText,
//         },
//         { status: 500 }
//       );
//     }

//     const grokData = await grokResponse.json();

//     console.log("Grok response:", JSON.stringify(grokData));

//     // Extract text answer
//     const answer =
//       grokData.output
//         ?.flatMap((item: any) => item.content || [])
//         ?.find((item: any) => item.type === "output_text")
//         ?.text ||
//       "I could not determine where the door is.";

//     console.log("Grok answer:", answer);

//     // --------------------------------------------------
//     // 4. Convert Grok answer to speech
//     // --------------------------------------------------

//     const ttsResponse = await fetch("https://api.x.ai/v1/tts", {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${process.env.GROK_API_KEY}`,
//       },
//       body: JSON.stringify({
//         text: answer,
//         voice_id: "eve",
//         language: "en",
//       }),
//     });

//     if (!ttsResponse.ok) {
//       const errorText = await ttsResponse.text();

//       console.error("TTS error:", errorText);

//       return Response.json(
//         {
//           error: "TTS failed",
//           details: errorText,
//           answer,
//         },
//         { status: 500 }
//       );
//     }

//     // --------------------------------------------------
//     // 5. Return MP3 directly to Raspberry Pi
//     // --------------------------------------------------

//     const audioBuffer = await ttsResponse.arrayBuffer();

//     return new Response(audioBuffer, {
//       status: 200,
//       headers: {
//         "Content-Type": "audio/mpeg",
//         "Content-Length": audioBuffer.byteLength.toString(),
//       },
//     });

//   } catch (error) {
//     console.error("Upload/analyze error:", error);

//     return Response.json(
//       {
//         error: "Upload/analyze failed",
//         details: error instanceof Error ? error.message : String(error),
//       },
//       { status: 500 }
//     );
//   }
// }


import { put } from "@vercel/blob";

export async function POST(request: Request) {
  try {
    // Get image from Pi
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "No image received" },
        { status: 400 }
      );
    }

    // --------------------------------------------------
    // 1. Save latest image to Vercel Blob
    // --------------------------------------------------

    await put("pi/latest.jpg", file, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    // --------------------------------------------------
    // 2. Convert image to base64 for Grok
    // --------------------------------------------------

    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const base64Image = imageBuffer.toString("base64");

    // --------------------------------------------------
    // 3. Ask Grok to analyze the image
    // --------------------------------------------------

    const grokResponse = await fetch("https://api.x.ai/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || "grok-4.5",

        input: [
          {
            role: "user",
            content: [
              {
                type: "input_image",
                image_url: `data:image/jpeg;base64,${base64Image}`,
              },
              {
                type: "input_text",
                text:
                  // "You are assisting a blind person navigating their surroundings. " +
                  // "Look carefully at the image and answer this question: Where is the door? " +
                  // "Give a short, clear spoken answer describing the door's direction " +
                  // "and approximate distance if that can reasonably be inferred from the image. " +
                  // "Use simple language. Do not invent details that are not visible. " +
                  // "Keep the answer to one or two sentences.",
                  "You are the visual intelligence for a blind/low-vision visual assistant. " +
                  "You get one photo and a spoken question; your answer is spoken aloud. " +
                  "Answer directly, briefly, and spatially. " +
                  "Use clock positions and directions, such as nine o'clock or slightly left. " +
                  "Give practical distance estimates like arm's reach, a few steps, or across the room. " +
                  "Mark distances as approximate, never as exact measurements, since depth can't be measured from one image. " +
                  "If something is unclear, say so briefly but stay useful. " +
                  "Never guarantee the safety of roads, stairs, food, or medication; describe what's visible instead. " +
                  "Never invent text. " +
                  "Avoid disclaimers and don't repeat the question. ",
              },
            ],
          },
        ],
      }),
    });

    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();

      console.error("Grok analysis error:", errorText);

      return Response.json(
        {
          error: "Grok analysis failed",
          details: errorText,
        },
        { status: 500 }
      );
    }

    const grokData = await grokResponse.json();

    console.log("Grok response:", JSON.stringify(grokData));

    // Extract text answer
    const answer =
      grokData.output
        ?.flatMap((item: any) => item.content || [])
        ?.find((item: any) => item.type === "output_text")
        ?.text ||
      "I could not determine the spatial surroundings.";

    console.log("Grok answer:", answer);

    // --------------------------------------------------
    // 4. Convert Grok answer to speech
    // --------------------------------------------------

    const ttsResponse = await fetch("https://api.x.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        text: answer,
        voice_id: "eve",
        language: "en",
      }),
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();

      console.error("TTS error:", errorText);

      return Response.json(
        {
          error: "TTS failed",
          details: errorText,
          answer,
        },
        { status: 500 }
      );
    }

    // --------------------------------------------------
    // 5. Return MP3 directly to Raspberry Pi
    // --------------------------------------------------

    const audioBuffer = await ttsResponse.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error("Upload/analyze error:", error);

    return Response.json(
      {
        error: "Upload/analyze failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}