//Load the library and specify options
console.log('pre-gh-pages-publish -Modifying library paths for Github Pages\n')
const replace = require('replace-in-file')
replace.sync({
  files: 'build/build/index.js',
  from: /\/build\/library/g,
  to: 'build/library'
})
