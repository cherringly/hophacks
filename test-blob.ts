import { put } from "@vercel/blob";

async function main() {
  const blob = await put(
    "test.txt",
    "Hello from NavAssist!",
    {
      access: "public",
    }
  );

  console.log("Uploaded:");
  console.log(blob.url);
}

main();