import util from "node:util";
import net from "node:net";
import {exec as _exec, spawn} from "node:child_process";
import {isLinux, isMac, isWin} from "../../lib/env";
import {Log} from "../log/index";

const exec = util.promisify(_exec)

const shell = async (command: string) => {
    return exec(command, {
        env: {...process.env},
        shell: true,
        encoding: 'utf8',
    } as any)
}

const spawnShell = async (command: string | string[], option: {
    stdout?: Function,
    stderr?: Function,
    success?: Function,
    error?: Function,
} | null = null): Promise<{
    stop: () => void,
    send: (data: any) => void,
    result: () => Promise<string>
}> => {
    option = option || {} as any
    let commandEntry = '', args = []
    if (Array.isArray(command)) {
        commandEntry = command[0]
        args = command.slice(1)
    } else {
        args = command.split(' ')
        commandEntry = args.shift() as string
    }
    Log.info('App.spawnShell', {commandEntry, args})
    const spawnProcess = spawn(commandEntry, args, {
        env: {...process.env},
        shell: true,
        encoding: 'utf8',
    } as any)
    // console.log('spawnProcess.start', spawnProcess)
    let end = false
    let isSuccess = false
    let exitCode = -1
    const stdoutList: string[] = []
    const stderrList: string[] = []
    // spawnProcess.stdout.setEncoding('utf8');
    spawnProcess.stdout?.on('data', (data) => {
        const stringData = data.toString()
        Log.info('App.spawnShell.stdout', stringData)
        stdoutList.push(stringData)
        option.stdout?.(stringData, spawnProcess)
    })
    // spawnProcess.stderr.setEncoding('utf8');
    spawnProcess.stderr?.on('data', (data) => {
        const stringData = data.toString()
        Log.info('App.spawnShell.stderr', stringData)
        stderrList.push(stringData)
        option.stderr?.(stringData, spawnProcess)
    })
    spawnProcess.on('exit', (code) => {
        Log.info('App.spawnShell.exit', JSON.stringify(code))
        exitCode = code
        if (isWin) {
            if (0 === code || 1 === code) {
                isSuccess = true
            }
        } else {
            if (null === code || 0 === code) {
                isSuccess = true
            }
        }
        if (isSuccess) {
            option.success?.(null)
        } else {
            option.error?.(`command ${command} failed with code ${code}`)
        }
        end = true
    })
    spawnProcess.on('error', (err) => {
        Log.info('App.spawnShell.error', err)
        option.error?.(err)
        end = true
    })
    return {
        stop: () => {
            Log.info('App.spawnShell.stop')
            if (isWin) {
                _exec(`taskkill /pid ${spawnProcess.pid} /T /F`, (err, stdout, stderr) => {
                    Log.info('App.spawnShell.stop.taskkill', JSON.parse(JSON.stringify({err, stdout, stderr})))
                })
            } else {
                spawnProcess.kill('SIGINT')
            }
        },
        send: (data) => {
            Log.info('App.spawnShell.send', data)
            spawnProcess.stdin.write(data)
        },
        result: async (): Promise<string> => {
            if (end) {
                return stdoutList.join('') + stderrList.join('')
            }
            return new Promise((resolve, reject) => {
                spawnProcess.on('exit', (code) => {
                    const watchEnd = () => {
                        setTimeout(() => {
                            if (!end) {
                                watchEnd()
                                return
                            }
                            if (isSuccess) {
                                resolve(stdoutList.join('') + stderrList.join(''))
                            } else {
                                reject(`command ${command} failed with code ${exitCode}`)
                            }
                        }, 10)
                    }
                    watchEnd()
                })
            })
        }
    }
}

/**
 * 获取一个可用的端口
 * @param start 开始的端口
 */
const availablePort = async (start: number): Promise<number> => {
    for (let i = start; i < 65535; i++) {
        const available = await isPortAvailable(i, '0.0.0.0')
        const availableLocal = await isPortAvailable(i, '127.0.0.1')
        // console.log('isPortAvailable', i, available, availableLocal)
        if (available && availableLocal) {
            return i
        }
    }
    throw new Error('no available port')
}


const isPortAvailable = async (port: number, host?: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const server = net.createServer()
        server.listen(port, host)
        server.on('listening', () => {
            server.close()
            resolve(true)
        })
        server.on('error', () => {
            resolve(false)
        })
    })
}

const fixExecutable = async (executable: string) => {
    if (isMac || isLinux) {
        // chmod +x executable
        await shell(`chmod +x "${executable}"`)
    }
}

export const Apps = {
    shell,
    spawnShell,
    availablePort,
    isPortAvailable,
}

export default {
    shell,
    spawnShell,
    availablePort,
    fixExecutable,
}
