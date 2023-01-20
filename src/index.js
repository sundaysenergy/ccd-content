import processContent from "./data.js";

processContent({
  mergeFrontmatter: true,
  fields: ['mtime', 'ctime', 'fileSlug', 'size', 'collection'],
  parentDir: 'content',
  outputDir: 'static',
})
