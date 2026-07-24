/**
 * Live smoke: same extract path as the API route (OpenRouter free + heal).
 * Run from repo root: npx tsx scripts/smoke-resume-extract.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { generateObject, NoObjectGeneratedError } from "ai";

import { withOpenRouterKeyFailover } from "../lib/ai/provider";
import {
    EXTRACT_SYSTEM_PROMPT,
    finalizeExtract,
    parseExtractFromModelText,
    profileExtractSchema,
} from "../lib/resume-extract";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const SAMPLE_RESUME = `
ARYAN SRIVASTAVA
Phone: +91 8707 392 404
Email: aryansri20011967@gmail.com
Location: Bengaluru, India

EXPERIENCE
Software Engineer — Example Corp (Jan 2022 – Present)
- Built web apps with React and TypeScript
- Led frontend features for job search products

SKILLS
React, TypeScript, Next.js, Node.js

EDUCATION
B.Tech Computer Science — Example University — 2021
`;

async function main() {
  const healed = parseExtractFromModelText(
    '{"phone":"+91 8707 392 404","location":"","name":"ARYAN SRIVASTAVA","email":"aryansri20011967@gmail.com"}',
    SAMPLE_RESUME,
  );
  console.log("heal-from-log:", healed?.full_name, healed?.phone, healed?.salary_expectation);
  if (!healed?.full_name || !healed.phone) {
    console.error("static heal failed");
    process.exit(1);
  }

  try {
    const { object } = await withOpenRouterKeyFailover((model) =>
      generateObject({
        model,
        schema: profileExtractSchema,
        temperature: 0.2,
        maxOutputTokens: 4096,
        system: EXTRACT_SYSTEM_PROMPT,
        prompt: `Extract a complete profile JSON from this resume. Remember: work_experience dates must be YYYY-MM, responsibilities must be a single string (not an array), and education.field_of_study must be separate from degree. Infer salary_expectation from experience and skills.\n\nResume text:\n\n${SAMPLE_RESUME}`,
      }),
    );
    const data = finalizeExtract(object, SAMPLE_RESUME);
    console.log("live-success:", {
      full_name: data.full_name,
      phone: data.phone,
      skills: data.skills,
      work_experience: data.work_experience,
      education: data.education,
      salary_expectation: data.salary_expectation,
    });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      const fromText = parseExtractFromModelText(error.text ?? "", SAMPLE_RESUME);
      const fromValue = finalizeExtract(
        (error.cause as { value?: unknown } | undefined)?.value ?? {},
        SAMPLE_RESUME,
      );
      const data =
        fromText && (fromText.full_name || fromText.phone)
          ? fromText
          : fromValue;
      console.log("live-healed:", {
        full_name: data.full_name,
        phone: data.phone,
        skills: data.skills,
        work_experience: data.work_experience,
        education: data.education,
        salary_expectation: data.salary_expectation,
      });
      if (!data.full_name && !data.phone) {
        console.error("heal produced empty extract");
        process.exit(1);
      }
    } else {
      console.error(error);
      process.exit(1);
    }
  }
}

main();
