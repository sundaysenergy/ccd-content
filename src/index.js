import processContent from "./data.js";

processContent({
  // mergeFrontmatter: true,
  // fields: ['mtime', 'ctime', 'fileSlug', 'size', 'sourcePath', 'collection'],
  keyIndex: false,
  parentDir: 'content',
  outputDir: 'static',
})

const info = `
type Info { path: String
  sourcePath: String
  blocks: Int
  mtime: String
  ctime: String
  size: Int
  root: String
  dir: String
  base: String
  ext: String
  name: String
  fileSlug: String
  parentDir: String
  collection: String
  pathParts: [String ]
}
type Nav {
  info: Info
}
type Page {
  info: Info
}
type Data {
  info: Info
}
`
