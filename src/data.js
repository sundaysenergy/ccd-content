import _ from 'lodash/fp.js'
import { isFalse, neq } from 'understory'
import { copy, mergeFieldsWith, propDo, setField, setFieldWith } from 'prairie'
import matter from 'gray-matter'
import { promises as fsxtr } from 'fs-extender'
import pathParse from 'path-parse'
import fse from 'fs-extra'
import graphqlServer from 'json-graphql-server'
import { mergeTypeDefs } from '@graphql-tools/merge'
import { print } from "graphql"

const { getPlainSchema } = graphqlServer
// npm install lodash understory prairie gray-matter fs-extender path-parse fs-extra

// pathParams and pathParts are both an array
const pathLevelProps = _.curry((pathParams, pathParts) => _.zipObject(pathParams, pathParts.slice(0, pathParams.length)))

function addContent({ fields, mergeFrontmatter, parentDir }) {
  return (info) => {
    const infoKeep = fields ? _.pick(fields, info) : _.omit(['isDirectory'], info)
    const { data = {}, content, excerpt } = matter.read(`./${parentDir}` + info.path, { excerpt: true })
    if (content) {
      data.content = _.trim(content)
      data.excerpt = excerpt || null
    }
    // Create a default id field.
    if (!data.id) data.id = info.fileSlug
    return mergeFrontmatter ? { ...infoKeep, ...data } : _.set('info', infoKeep, data)
  }
}

const getFileSlugDefault = ({ base, ext }) => _.flow(_.replace(ext, ''), _.kebabCase)(base)

const fixFileInfo = ({ getFileSlug, parentDir }) => _.flow(
  setFieldWith('isDirectory', 'stats', (x) => x.isDirectory()),
  copy('path', 'sourcePath'),
  _.update('path', _.replace(parentDir, '')),
  ({ stats, ...rest }) => ({ ...rest, ..._.pick(['blocks', 'mtime', 'ctime', 'size'], stats) }),
  mergeFieldsWith('path', pathParse),
  setFieldWith('pathParts', 'path', _.flow(_.trimCharsStart('/'), _.split('/'))),
  setField('fileSlug', getFileSlug || getFileSlugDefault),
  _.set('parentDir', parentDir),
)
const isNotDotFile = (path) => path && !path.startsWith('/.')
const fixFileInfos = (opts) => _.flow(
  _.map(fixFileInfo(opts)),
  _.filter(_.overEvery([
    propDo('path', isNotDotFile),
    propDo('blocks', neq(0)),
    propDo('isDirectory', isFalse),
  ])),
)
const schema2 = `
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

type NavItemChild { title: String, path: String }

type NavItem {
  title: String
  path: String
  has_children: Boolean
  children: [NavItemChild]
}
type Nav {
  info: Info
  navItems: [NavItem]
}
type Page {
  info: Info
}
type Data {
  info: Info
}
`
function saveOutput(opts) {
  const { keyIndex, outputFilename = 'index', outputDir, parentDir } = opts
  const getPath = (name, ext = 'json') => `${outputDir}/${parentDir}/${name}.${ext}`
  return (data) => {
    const collection = _.groupBy('info.collection', data)
    const collections = _.toPairs(collection)
    const schema1 = getPlainSchema(collection)
    const schema = mergeTypeDefs([schema2, schema1.typeDefs], { ignoreFieldConflicts: true })
    // console.log()
    return Promise.all([
      fse.outputFile(getPath('schema', 'graphql'), print(schema)),
      fse.outputJSON(getPath(outputFilename), keyIndex ? collection : data),
      ...collections.map(([collectionId, items]) => fse.outputJSON(getPath(collectionId), items)),
    ])
  }
}

function processContent(opts) {
  const { outputDir, parentDir, pathProps, outputPath } = opts
  return fsxtr.list(parentDir)
    .then(fixFileInfos(opts))
    .then(_.map(_.flow(
      mergeFieldsWith('pathParts', pathLevelProps(pathProps || ['collection'])),
      addContent(opts),
    )))
    .then(saveOutput(opts))
    .then(() => console.log('BUILD DATA: DONE'))
}
export default processContent
