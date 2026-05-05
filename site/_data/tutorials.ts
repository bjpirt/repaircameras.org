import fs from "fs";
import Path from "path";
import Image from "@11ty/eleventy-img";
import { TutorialSchema } from "../../lib/types/tutorial.ts";
import type { ProcessedStep, ProcessedTutorial } from "../../lib/types/tutorial.ts";

const TUTORIALS_DIR = "site/tutorials";
const IMAGE_OUTPUT_DIR = "_site/img/tutorials";
const IMAGE_URL_PATH = "/img/tutorials/";

async function processSteps(id: string, steps: any[]): Promise<ProcessedStep[]> {
  const file = `${TUTORIALS_DIR}/${id}/tutorial.json`;
  return Promise.all(
    steps.map(async (step) => {
      const processedPhotos = await Promise.all(
        step.photos.map(async (photo: any) => {
          const imagePath = `${TUTORIALS_DIR}/${id}/images/${photo.filename}`;
          const imageExists = await fs.promises
            .access(imagePath, fs.constants.F_OK)
            .then(() => true)
            .catch(() => false);

          if (!imageExists) {
            throw new Error(
              `Tutorial image not found: ${imagePath} (referenced in ${file})`
            );
          }

          const image = await Image(imagePath, {
            widths: [400, 800, 1200],
            outputDir: IMAGE_OUTPUT_DIR,
            urlPath: IMAGE_URL_PATH,
          });

          return { ...photo, image };
        })
      );

      return { ...step, photos: processedPhotos };
    })
  );
}

function resolvePrerequisites(
  tutorial: ProcessedTutorial,
  allTutorials: Map<string, ProcessedTutorial>,
  visited: Set<string> = new Set()
): ProcessedStep[] {
  if (visited.has(tutorial.id)) {
    throw new Error(`Circular prerequisite dependency detected: ${[...visited, tutorial.id].join(" -> ")}`);
  }
  visited.add(tutorial.id);

  const prerequisiteSteps: ProcessedStep[] = [];
  for (const prereqId of tutorial.prerequisites) {
    const prereq = allTutorials.get(prereqId);
    if (!prereq) {
      throw new Error(`Tutorial "${tutorial.id}" has prerequisite "${prereqId}" which does not exist`);
    }
    // Recursively resolve the prerequisite's own prerequisites first
    const resolved = resolvePrerequisites(prereq, allTutorials, new Set(visited));
    prerequisiteSteps.push(...resolved);

    // Then add this prerequisite's own steps, tagged with their source
    const taggedSteps = prereq.steps
      .filter((s) => !s.source) // only the prereq's own steps, not its prerequisites (already resolved above)
      .map((step) => ({
        ...step,
        source: { tutorialId: prereq.id, tutorialTitle: prereq.title },
      }));
    prerequisiteSteps.push(...taggedSteps);
  }

  return prerequisiteSteps;
}

const tutorials = async () => {
  const entries = await fs.promises.readdir(TUTORIALS_DIR, {
    withFileTypes: true,
  });
  const tutorialDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  // First pass: load and process all tutorials
  const allTutorials = new Map<string, ProcessedTutorial>();

  for (const id of tutorialDirs) {
    const file = `${TUTORIALS_DIR}/${id}/tutorial.json`;
    const raw = JSON.parse(await fs.promises.readFile(file, "utf8"));

    const result = TutorialSchema.safeParse({ ...raw, id });
    if (!result.success) {
      console.error(`Invalid tutorial ${file}:`, result.error.format());
      throw new Error(`Tutorial validation failed for ${file}`);
    }

    const tutorial = result.data;
    const processedSteps = await processSteps(id, tutorial.steps);

    allTutorials.set(id, { ...tutorial, steps: processedSteps });
  }

  // Second pass: resolve prerequisites and merge steps
  const output: ProcessedTutorial[] = [];

  for (const tutorial of allTutorials.values()) {
    if (tutorial.prerequisites.length === 0) {
      output.push(tutorial);
      continue;
    }

    const prerequisiteSteps = resolvePrerequisites(tutorial, allTutorials);

    // Deduplicate tools while preserving order
    const mergedTools = [
      ...new Set([
        ...tutorial.prerequisites.flatMap((id) => allTutorials.get(id)?.tools ?? []),
        ...tutorial.tools,
      ]),
    ];

    output.push({
      ...tutorial,
      tools: mergedTools,
      steps: [...prerequisiteSteps, ...tutorial.steps],
    });
  }

  return output;
};

export default tutorials;
