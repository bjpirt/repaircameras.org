import fs from "fs";
import Path from "path";
import Image from "@11ty/eleventy-img";
import { TutorialSchema } from "../../lib/types/tutorial.ts";

const TUTORIALS_DIR = "site/tutorials";
const IMAGE_OUTPUT_DIR = "_site/img/tutorials";
const IMAGE_URL_PATH = "/img/tutorials/";

const tutorials = async () => {
  const entries = await fs.promises.readdir(TUTORIALS_DIR, {
    withFileTypes: true,
  });
  const tutorialDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const output = [];

  for (const id of tutorialDirs) {
    const file = `${TUTORIALS_DIR}/${id}/tutorial.json`;
    const raw = JSON.parse(await fs.promises.readFile(file, "utf8"));

    const result = TutorialSchema.safeParse({ ...raw, id });
    if (!result.success) {
      console.error(`Invalid tutorial ${file}:`, result.error.format());
      throw new Error(`Tutorial validation failed for ${file}`);
    }

    const tutorial = result.data;

    const processedSteps = await Promise.all(
      tutorial.steps.map(async (step) => {
        const processedPhotos = await Promise.all(
          step.photos.map(async (photo) => {
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

    output.push({ ...tutorial, steps: processedSteps });
  }

  return output;
};

export default tutorials;
