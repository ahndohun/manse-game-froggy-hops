import { writeFile } from "node:fs/promises";

const sampleRate = 22_050;
const durationSeconds = 0.42;
const sampleCount = Math.round(sampleRate * durationSeconds);
const data = Buffer.alloc(sampleCount * 2);
for (let index = 0; index < sampleCount; index += 1) {
  const time = index / sampleRate;
  const envelope = Math.sin(Math.PI * index / sampleCount) ** 2;
  const ripple = Math.sin(Math.PI * 2 * 523.25 * time) * 0.65 + Math.sin(Math.PI * 2 * 659.25 * time) * 0.35;
  data.writeInt16LE(Math.round(ripple * envelope * 0.16 * 32_767), index * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
await writeFile(new URL("../public/packs/froggy-hops/assets/audio/ready.wav", import.meta.url), Buffer.concat([header, data]));
console.log("Generated conservative Froggy Hops ready ripple.");
