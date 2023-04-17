/*
 * @adonisjs/assembler
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import picomatch from 'picomatch'
import type tsStatic from 'typescript'
import { type ExecaChildProcess } from 'execa'
import { cliui, type Logger } from '@poppinss/cliui'
import type { Watcher } from '@poppinss/chokidar-ts'

import type { DevServerOptions } from './types.js'
import { AssetsDevServer } from './assets_dev_server.js'
import { getPort, isDotEnvFile, isRcFile, runNode, watch } from './helpers.js'

/**
 * Instance of CLIUI
 */
const ui = cliui()

/**
 * Exposes the API to start the development. Optionally, the watch API can be
 * used to watch for file changes and restart the development server.
 *
 * The Dev server performs the following actions
 *
 * - Assigns a random PORT, when PORT inside .env file is in use
 * - Uses tsconfig.json file to collect a list of files to watch.
 * - Uses metaFiles from .adonisrc.json file to collect a list of files to watch.
 * - Restart HTTP server on every file change.
 */
export class DevServer {
  #cwd: URL
  #logger = ui.logger
  #options: DevServerOptions
  #isWatching: boolean = false
  #scriptFile: string = 'bin/server.js'
  #isMetaFileWithReloadsEnabled: picomatch.Matcher
  #isMetaFileWithReloadsDisabled: picomatch.Matcher

  #onError?: (error: any) => any
  #onClose?: (exitCode: number) => any

  #httpServer?: ExecaChildProcess<string>
  #watcher?: ReturnType<Watcher['watch']>
  #assetsServer?: AssetsDevServer

  /**
   * Getting reference to colors library from logger
   */
  get #colors() {
    return this.#logger.getColors()
  }

  constructor(cwd: URL, options: DevServerOptions) {
    this.#cwd = cwd
    this.#options = options

    this.#isMetaFileWithReloadsEnabled = picomatch(
      (this.#options.metaFiles || [])
        .filter(({ reloadServer }) => reloadServer === true)
        .map(({ pattern }) => pattern)
    )

    this.#isMetaFileWithReloadsDisabled = picomatch(
      (this.#options.metaFiles || [])
        .filter(({ reloadServer }) => reloadServer !== true)
        .map(({ pattern }) => pattern)
    )
  }

  /**
   * Inspect if child process message is from AdonisJS HTTP server
   */
  #isAdonisJSReadyMessage(
    message: unknown
  ): message is { isAdonisJS: true; environment: 'web'; port: number; host: string } {
    return (
      message !== null &&
      typeof message === 'object' &&
      'isAdonisJS' in message &&
      'environment' in message &&
      message.environment === 'web'
    )
  }

  /**
   * Conditionally clear the terminal screen
   */
  #clearScreen() {
    if (this.#options.clearScreen) {
      process.stdout.write('\u001Bc')
    }
  }

  /**
   * Starts the HTTP server
   */
  #startHTTPServer(port: string, mode: 'blocking' | 'nonblocking') {
    this.#httpServer = runNode(this.#cwd, {
      script: this.#scriptFile,
      env: { PORT: port, ...this.#options.env },
      nodeArgs: this.#options.nodeArgs,
      scriptArgs: this.#options.scriptArgs,
    })

    this.#httpServer.on('message', (message) => {
      if (this.#isAdonisJSReadyMessage(message)) {
        ui.sticker()
          .useColors(this.#colors)
          .useRenderer(this.#logger.getRenderer())
          .add(`Server address: ${this.#colors.cyan(`http://${message.host}:${message.port}`)}`)
          .add(
            `File system watcher: ${this.#colors.cyan(
              `${this.#isWatching ? 'enabled' : 'disabled'}`
            )}`
          )
          .render()
      }
    })

    this.#httpServer
      .then((result) => {
        this.#logger.warning(`underlying HTTP server closed with status code "${result.exitCode}"`)
        if (mode === 'nonblocking') {
          this.#onClose?.(result.exitCode)
          this.#watcher?.close()
          this.#assetsServer?.stop()
        }
      })
      .catch((error) => {
        this.#logger.warning('unable to connect to underlying HTTP server process')
        this.#logger.fatal(error)
        this.#onError?.(error)
        this.#watcher?.close()
        this.#assetsServer?.stop()
      })
  }

  /**
   * Starts the assets server
   */
  #startAssetsServer() {
    this.#assetsServer = new AssetsDevServer(this.#cwd, this.#options.assets)
    this.#assetsServer.setLogger(this.#logger)
    this.#assetsServer.start()
  }

  /**
   * Restarts the HTTP server
   */
  #restartHTTPServer(port: string) {
    if (this.#httpServer) {
      this.#httpServer.removeAllListeners()
      this.#httpServer.kill('SIGKILL')
    }

    this.#startHTTPServer(port, 'blocking')
  }

  /**
   * Handles a non TypeScript file change
   */
  #handleFileChange(action: string, port: string, relativePath: string) {
    if (isDotEnvFile(relativePath) || isRcFile(relativePath)) {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
      this.#restartHTTPServer(port)
      return
    }

    if (this.#isMetaFileWithReloadsEnabled(relativePath)) {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
      this.#restartHTTPServer(port)
      return
    }

    if (this.#isMetaFileWithReloadsDisabled(relativePath)) {
      this.#clearScreen()
      this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
    }
  }

  /**
   * Handles TypeScript source file change
   */
  #handleSourceFileChange(action: string, port: string, relativePath: string) {
    this.#clearScreen()
    this.#logger.log(`${this.#colors.green(action)} ${relativePath}`)
    this.#restartHTTPServer(port)
  }

  /**
   * Set a custom CLI UI logger
   */
  setLogger(logger: Logger) {
    this.#logger = logger
    this.#assetsServer?.setLogger(logger)
    return this
  }

  /**
   * Add listener to get notified when dev server is
   * closed
   */
  onClose(callback: (exitCode: number) => any): this {
    this.#onClose = callback
    return this
  }

  /**
   * Add listener to get notified when dev server exists
   * with an error
   */
  onError(callback: (error: any) => any): this {
    this.#onError = callback
    return this
  }

  /**
   * Start the development server
   */
  async start() {
    this.#clearScreen()
    this.#logger.info('starting HTTP server...')
    this.#startHTTPServer(String(await getPort(this.#cwd)), 'nonblocking')
    this.#startAssetsServer()
  }

  /**
   * Start the development server in watch mode
   */
  async startAndWatch(ts: typeof tsStatic, options?: { poll: boolean }) {
    const port = String(await getPort(this.#cwd))
    this.#isWatching = true

    this.#clearScreen()

    this.#logger.info('starting HTTP server...')
    this.#startHTTPServer(port, 'blocking')

    this.#startAssetsServer()

    /**
     * Create watcher using tsconfig.json file
     */
    const output = watch(this.#cwd, ts, options || {})
    if (!output) {
      this.#onClose?.(1)
      return
    }

    /**
     * Storing reference to watcher, so that we can close it
     * when HTTP server exists with error
     */
    this.#watcher = output.chokidar

    /**
     * Notify the watcher is ready
     */
    output.watcher.on('watcher:ready', () => {
      this.#logger.info('watching file system for changes...')
    })

    /**
     * Cleanup when watcher dies
     */
    output.chokidar.on('error', (error) => {
      this.#logger.warning('file system watcher failure')
      this.#logger.fatal(error)
      this.#onError?.(error)
      output.chokidar.close()
    })

    /**
     * Changes in TypeScript source file
     */
    output.watcher.on('source:add', ({ relativePath }) =>
      this.#handleSourceFileChange('add', port, relativePath)
    )
    output.watcher.on('source:change', ({ relativePath }) =>
      this.#handleSourceFileChange('update', port, relativePath)
    )
    output.watcher.on('source:unlink', ({ relativePath }) =>
      this.#handleSourceFileChange('delete', port, relativePath)
    )

    /**
     * Changes in non-TypeScript source files
     */
    output.watcher.on('add', ({ relativePath }) =>
      this.#handleFileChange('add', port, relativePath)
    )
    output.watcher.on('change', ({ relativePath }) =>
      this.#handleFileChange('update', port, relativePath)
    )
    output.watcher.on('unlink', ({ relativePath }) =>
      this.#handleFileChange('delete', port, relativePath)
    )
  }
}
