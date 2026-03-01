import fs from "fs";
import Path from "path";
import Image from "@11ty/eleventy-img";
import { TutorialSchema } from "../../lib/types/tutorial.ts";

const TUTORIALS_DIR = "site/tutorials";
const IMAGES_DIR = `${TUTORIALS_DIR}/images`;
const IMAGE_OUTPUT_DIR = "_site/img/tutorials";
const IMAGE_URL_PATH = "/img/tutorials/";

const tutorials = async () => {
  const tutorialFiles = (await fs.promises.readdir(TUTORIALS_DIR))
    .filter((f) => f.endsWith(".json"))
    .map((f) => `${TUTORIALS_DIR}/${f}`);

  const output = [];

  for (const file of tutorialFiles) {
    const id = Path.parse(file).name;
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
            const imagePath = `${IMAGES_DIR}/${id}/${photo.filename}`;
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
              widths: [400, 800],
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
