import "tsx/esm";
import { jsxToString } from "jsx-async-runtime";
import sass from "sass";
import { resolve } from "path";

export async function eleventySetup(eleventyConfig) {
  eleventyConfig.addExtension(["11ty.jsx", "11ty.ts", "11ty.tsx"], {
    key: "11ty.js",
    compile: function () {
      return async function (data) {
        const content = await this.defaultRenderer(data);
        const result = await jsxToString(content);
        return `<!doctype html>\n${result}`;
      };
    },
  });

  eleventyConfig.addTemplateFormats("11ty.ts,11ty.tsx");
  eleventyConfig.addWatchTarget("./components/");

  // Support TypeScript data files — tsx/esm hook handles the transformation
  eleventyConfig.addDataExtension("ts", {
    read: false,
    parser: async (filePath) => {
      const mod = await import(resolve(filePath));
      return typeof mod.default === "function" ? mod.default() : mod.default;
    },
  });

  eleventyConfig.addTemplateFormats("scss");

  // Creates the extension for use
  eleventyConfig.addExtension("scss", {
    outputFileExtension: "css",

    // `compile` is called once per .scss file in the input directory
    compile: async function (inputContent) {
      let result = sass.compileString(inputContent);

      // This is the render function, `data` is the full data cascade
      return async (data) => {
        return result.css;
      };
    },
  });

  eleventyConfig.addPassthroughCopy("site/files/**/*.pdf");
  eleventyConfig.addPassthroughCopy("site/static/img/*");
  eleventyConfig.addPassthroughCopy("site/static/js/*.js");
  eleventyConfig.addPassthroughCopy("site/admin");
  eleventyConfig.addWatchTarget("./site/tutorials/");

  return {
    dir: {
      input: "site",
      layouts: "../_layouts",
    },
  };
}

export default eleventySetup;
