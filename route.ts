import { put } from "@vercel/blob";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "No image received" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();

    const blob = await put(
      "pi/latest.jpg",
      file,
      {
        access: "public",
        addRandomSuffix: false,
      }
    );

    return Response.json({
      success: true,
      url: blob.url,
      timestamp,
    });

  } catch (error) {
    console.error("Upload error:", error);

    return Response.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}