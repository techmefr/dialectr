import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: ['src/index', 'src/lomkit'],
  declaration: true,
  clean: true,
})
