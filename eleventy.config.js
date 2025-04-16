import "tsx/esm";
import { jsxToString } from "jsx-async-runtime";
import sass from "sass";

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

  eleventyConfig.addPassthroughCopy("site/files/*.pdf");
  eleventyConfig.addPassthroughCopy("site/static/img/*");

  return {
    dir: {
      input: "site",
      layouts: "../_layouts",
    },
  };
}

export default eleventySetup;
