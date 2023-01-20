import _ from 'lodash/fp.js'
import { isFalse, neq } from 'understory'
import { mergeFieldsWith, propDo, setField, setFieldWith } from 'prairie'
import matter from 'gray-matter'
import { promises as fsxtr } from 'fs-extender'
import pathParse from 'path-parse'
import fse from 'fs-extra'

// npm install lodash understory prairie gray-matter fs-extender path-parse fs-extra

// pathParams and pathParts are both an array
const pathLevelProps = _.curry((pathParams, pathParts) => _.zipObject(pathParams, pathParts.slice(0, pathParams.length)))

function addContent({ fields, mergeFrontmatter, parentDir }) {
  return (info) => {
    const infoKeep = fields ? _.pick(fields, info) : _.omit(['isDirectory'], info)
    const { data = {}, content, excerpt } = matter.read(`./${parentDir}` + info.path, { excerpt: true })
    if (content) {
      data.content = _.trim(content)
      data.excerpt = excerpt
    }
    return mergeFrontmatter ? { ...infoKeep, ...data } : _.set('data', data, infoKeep)
  }
}

const getFileSlugDefault = ({ base, ext }) => _.flow(_.replace(ext, ''), _.kebabCase)(base)

const fixFileInfo = ({ getFileSlug, parentDir }) => _.flow(
  setFieldWith('isDirectory', 'stats', (x) => x.isDirectory()),
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

function processContent(opts) {
  const { outputDir, parentDir, outputPath } = opts
  const outPath = outputPath || `${outputDir}/${parentDir}.json`
  return fsxtr.list(parentDir)
    .then(fixFileInfos(opts))
    .then(_.map(_.flow(
      mergeFieldsWith('pathParts', pathLevelProps(['collection'])),
      addContent(opts),
    )))
    .then((data) => fse.outputJSON(outPath, data))
    .then(() => console.log('BUILD DATA: DONE'))
}
export default processContent
