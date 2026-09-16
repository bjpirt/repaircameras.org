import fs from "fs";
import Path from "path";

const PUBLICATIONS_DIR = "site/_data/publications";

// Publication metadata only — the issues themselves live in _data/ia and are
// joined on the publication id at render time (see lib/publications.ts)
const publications = async () => {
  const descriptors = (await fs.promises.readdir(PUBLICATIONS_DIR))
    .filter((f) => f.endsWith(".json"))
    .map((f) => `${PUBLICATIONS_DIR}/${f}`);

  const output = {};

  for (const descriptor of descriptors) {
    const id = Path.parse(descriptor).name;
    const data = JSON.parse(await fs.promises.readFile(descriptor));

    output[id] = {
      ...data,
      id,
      url: `/publications/${id}/`,
    };
  }

  return output;
};

export default publications;
