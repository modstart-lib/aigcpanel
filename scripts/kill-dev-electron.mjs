/**
 * kill-dev-electron.mjs — 在启动 dev 前清理本工程残留的开发版 Electron 进程。
 *
 * 背景：
 *   vite-plugin-electron 实际以 `electron . --no-sandbox` 启动，进程命令行里只有
 *   `<ROOT>/node_modules/electron/dist/...`，并不包含 `dist-electron/main/index.js`。
 *   上一次 dev 未正常退出时，残留实例会一直占用单实例锁（requestSingleInstanceLock），
 *   导致再次 `make dev` 时新窗口不显示。
 *
 * 安全边界（绝不误杀）：
 *   仅匹配「本工程根目录下 node_modules/electron/dist」这一路径前缀，
 *   因此不会命中同机其他 Electron 项目、编辑器（VSCode 等）或已安装的正式版应用。
 *   同时排除脚本自身及其父进程。
 *
 * 用法: node scripts/kill-dev-electron.mjs
 *       （由 Makefile 的 dev / dev-seed 目标，以及 dev:mac / dev:mac:pre 脚本在启动前调用）
 */

import {execFileSync} from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
// Marker is normalized to forward slashes so it matches command lines on every platform.
const MARKER = path.join(ROOT, 'node_modules', 'electron', 'dist').split(path.sep).join('/')

function parsePosix(output) {
    const result = []
    for (const line of output.split('\n')) {
        const matched = line.match(/^\s*(\d+)\s+(.*)$/)
        if (!matched) continue
        result.push({pid: Number(matched[1]), command: matched[2]})
    }
    return result
}

function parseWindows(output) {
    const result = []
    for (const line of output.split(/\r?\n/)) {
        const sep = line.indexOf('|')
        if (sep < 0) continue
        const pid = Number(line.slice(0, sep).trim())
        if (!Number.isFinite(pid) || pid <= 0) continue
        result.push({pid, command: line.slice(sep + 1)})
    }
    return result
}

function listProcesses() {
    const maxBuffer = 64 * 1024 * 1024
    if (process.platform === 'win32') {
        // Encode the PowerShell script to base64 to dodge shell quoting issues.
        const script = [
            'Get-CimInstance Win32_Process',
            '| Where-Object { $_.CommandLine }',
            '| ForEach-Object { "$($_.ProcessId)|$($_.CommandLine)" }',
        ].join(' ')
        const encoded = Buffer.from(script, 'utf16le').toString('base64')
        const output = execFileSync(
            'powershell',
            ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
            {encoding: 'utf8', maxBuffer},
        )
        return parseWindows(output)
    }
    const output = execFileSync('ps', ['-Ao', 'pid=,command='], {encoding: 'utf8', maxBuffer})
    return parsePosix(output)
}

function killProcess(pid) {
    if (process.platform === 'win32') {
        // /T kills the whole process tree, /F forces termination.
        execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {stdio: 'ignore'})
    } else {
        process.kill(pid, 'SIGKILL')
    }
}

function main() {
    let processes
    try {
        processes = listProcesses()
    } catch (error) {
        console.warn(`[kill-dev-electron] 读取进程列表失败，跳过清理: ${error.message}`)
        return
    }

    const targets = processes.filter(process_ => {
        if (process_.pid === process.pid) return false
        if (process_.pid === process.ppid) return false
        return process_.command.replaceAll('\\', '/').includes(MARKER)
    })

    if (targets.length === 0) {
        console.log('[kill-dev-electron] 无残留 Electron 进程')
        return
    }

    for (const target of targets) {
        try {
            killProcess(target.pid)
            console.log(`[kill-dev-electron] 已强制结束 Electron 进程 pid=${target.pid}`)
        } catch {
            // The process may have already exited between listing and killing.
        }
    }
}

main()
