/*
* @adonisjs/assembler
*
* (c) Harminder Virk <virk@adonisjs.com>
*
* For the full copyright and license information, please view the LICENSE
* file that was distributed with this source code.
*/

import execa from 'execa'
import test from 'japa'
import { join } from 'path'
import { Logger } from '@poppinss/fancy-logs'
import { Filesystem } from '@poppinss/dev-utils'

import { Compiler } from '../src/Compiler'

const fs = new Filesystem(join(__dirname, '__app'))

test.group('Compiler', (group) => {
  group.afterEach(async () => {
    await fs.cleanup()
  })

  test('build source files', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
      },
    }))

    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'build/src/foo.js',
      'build/public/styles/main.css',
      'build/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) Cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) Copy .adonisrc.json dim(yellow(build))',
      'underline(blue(info)) Copy public/**/*.(js|css) dim(yellow(build))',
      'underline(magenta(pending)) Compiling typescript source files',
      'underline(green(success)) Built successfully',
    ])

    assert.isFalse(require(join(fs.basePath, 'build', '.adonisrc.json')).typescript)
  }).timeout(0)

  test('build source files with explicit outDir', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        outDir: 'build',
      },
    }))

    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'build/src/foo.js',
      'build/public/styles/main.css',
      'build/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) Cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) Copy .adonisrc.json dim(yellow(build))',
      'underline(blue(info)) Copy public/**/*.(js|css) dim(yellow(build))',
      'underline(magenta(pending)) Compiling typescript source files',
      'underline(green(success)) Built successfully',
    ])
  }).timeout(0)

  test('build source files with explicit rootDir', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        rootDir: './',
        outDir: 'build',
      },
    }))

    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'build/src/foo.js',
      'build/public/styles/main.css',
      'build/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) Cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) Copy .adonisrc.json dim(yellow(build))',
      'underline(blue(info)) Copy public/**/*.(js|css) dim(yellow(build))',
      'underline(magenta(pending)) Compiling typescript source files',
      'underline(green(success)) Built successfully',
    ])
  }).timeout(0)

  test('build source files to nested outDir', async (assert) => {
    const logger = new Logger({ fake: true })
    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        rootDir: './',
        outDir: 'build/dist',
      },
    }))

    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/dist/.adonisrc.json',
      'build/dist/src/foo.js',
      'build/dist/public/styles/main.css',
      'build/dist/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) Cleaning up build directory dim(yellow(build/dist))',
      'underline(blue(info)) Copy .adonisrc.json dim(yellow(build/dist))',
      'underline(blue(info)) Copy public/**/*.(js|css) dim(yellow(build/dist))',
      'underline(magenta(pending)) Compiling typescript source files',
      'underline(green(success)) Built successfully',
    ])
  }).timeout(0)

  test('catch and report typescript errors', async (assert) => {
    const logger = new Logger({ fake: true })
    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        rootDir: './',
        outDir: 'build/dist',
      },
    }))

    await fs.add('src/foo.ts', `import path from 'path'`)
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/dist/.adonisrc.json',
      'build/dist/src/foo.js',
      'build/dist/public/styles/main.css',
      'build/dist/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])

    assert.deepEqual(logger.logs, [
      'underline(blue(info)) Cleaning up build directory dim(yellow(build/dist))',
      'underline(blue(info)) Copy .adonisrc.json dim(yellow(build/dist))',
      'underline(blue(info)) Copy public/**/*.(js|css) dim(yellow(build/dist))',
      'underline(magenta(pending)) Compiling typescript source files',
      'underline(red(error)) Typescript compiler errors',
    ])
  }).timeout(0)

  test('do not emit when noEmitOnError is true', async (assert) => {
    const logger = new Logger({ fake: true })
    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        rootDir: './',
        outDir: 'build/dist',
        noEmitOnError: true,
      },
    }))

    await fs.add('src/foo.ts', `import path from 'path'`)
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compile()

    const hasFiles = await Promise.all([
      'build/dist/.adonisrc.json',
      'build/dist/src/foo.js',
      'build/dist/public/styles/main.css',
      'build/dist/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, false, true, true])

    assert.deepEqual(logger.logs, [
      'underline(blue(info)) Cleaning up build directory dim(yellow(build/dist))',
      'underline(blue(info)) Copy .adonisrc.json dim(yellow(build/dist))',
      'underline(blue(info)) Copy public/**/*.(js|css) dim(yellow(build/dist))',
      'underline(magenta(pending)) Compiling typescript source files',
      'underline(blue(info)) Ts emit skipped',
      'underline(red(error)) Typescript compiler errors',
    ])
  }).timeout(0)

  test('build for production by doing npm install', async (assert) => {
    const logger = new Logger({ fake: true })

    await fs.add('.adonisrc.json', JSON.stringify({
      typescript: true,
      metaFiles: ['public/**/*.(js|css)'],
    }))

    await fs.add('package.json', JSON.stringify({
      name: 'my-dummy-app',
      dependencies: {
        'lodash': 'latest',
      },
    }))

    await fs.add('tsconfig.json', JSON.stringify({
      include: ['**/*'],
      exclude: ['build'],
      compilerOptions: {
        outDir: 'build',
      },
    }))

    await fs.add('src/foo.ts', '')
    await fs.add('public/styles/main.css', '')
    await fs.add('public/scripts/main.js', '')
    await execa('npm', ['install'], {
      buffer: false,
      cwd: fs.basePath,
      stdio: 'inherit',
    })

    const compiler = new Compiler(fs.basePath, false, [], logger)
    await compiler.compileForProduction('npm')

    const hasFiles = await Promise.all([
      'build/.adonisrc.json',
      'build/src/foo.js',
      'build/public/styles/main.css',
      'build/public/scripts/main.js',
    ].map((file) => fs.fsExtra.pathExists(join(fs.basePath, file))))

    assert.deepEqual(hasFiles, [true, true, true, true])
    assert.deepEqual(logger.logs, [
      'underline(blue(info)) Cleaning up build directory dim(yellow(build))',
      'underline(blue(info)) Copy .adonisrc.json dim(yellow(build))',
      'underline(blue(info)) Copy public/**/*.(js|css),package.json,package-lock.json dim(yellow(build))',
      'underline(magenta(pending)) Compiling typescript source files',
      'underline(green(success)) Built successfully',
      'underline(blue(info)) Installing production dependencies dim(yellow(npm))',
    ])

    const hasPackageLock = await fs.fsExtra.pathExists(join(fs.basePath, 'build', 'package-lock.json'))
    assert.isTrue(hasPackageLock)
  }).timeout(0)
})