// 包装 Tauri CLI（同步自 matrixtech-client-pc）：
//   1. `pnpm tauri build` 时按 tauri.conf.json 的 version 自动生成产物名
//      Particle-Mineradio_<version>.exe（通过 --config 覆盖 mainBinaryName，不用手改配置）；
//   2. 构建成功后把 exe 拷一份到 `src-tauri/target/release/installers/`，
//      不同版本的安装包各占一个文件，方便直接拿走。
//
// 其余子命令（dev / --version / android …）原样转发。

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const args = [...process.argv.slice(2)]

const cliName = process.platform === 'win32' ? 'tauri.cmd' : 'tauri'
const cli = join(root, 'node_modules', '.bin', cliName)

/** 产物超过这个时间就当它是旧的（CLI 报错时不会覆盖它） */
const FRESH_MS = 15 * 60 * 1000

const confPath = join(root, 'src-tauri', 'tauri.conf.json')
const conf = JSON.parse(readFileSync(confPath, 'utf8'))
const version = conf.version
const binName = `Particle-Mineradio_${version}`

const isBuild = args[0] === 'build'
if (isBuild) {
  // 用一份临时配置覆盖 mainBinaryName，版本号只维护 tauri.conf.json 一处
  const overridePath = join(root, 'src-tauri', 'target', '.tauri-build-override.json')
  mkdirSync(join(root, 'src-tauri', 'target'), { recursive: true })
  writeFileSync(overridePath, JSON.stringify({ mainBinaryName: binName }), 'utf8')
  args.push('--config', overridePath)
  console.log(`\n[builder] 版本 ${version} → ${binName}.exe`)
}

const res = spawnSync(cli, args, {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

if (isBuild) {
  const archived = archive()
  if (archived && (res.status ?? 1) !== 0) {
    // Tauri CLI 在 Windows 上偶发"构建成功但退出码 1"，用产物时间戳兜底
    console.log(`\n[installer] 构建产物是新的，忽略 CLI 的退出码 ${res.status}`)
    process.exit(0)
  }
}

process.exit(res.status ?? 1)

/** 把刚构建出来的安装包拷贝到 installers/ */
function archive() {
  const src = join(root, 'src-tauri', 'target', 'release', `${binName}.exe`)
  if (!existsSync(src)) return null
  if (Date.now() - statSync(src).mtimeMs > FRESH_MS) return null

  const outDir = join(root, 'src-tauri', 'target', 'release', 'installers')
  mkdirSync(outDir, { recursive: true })

  const dest = join(outDir, `${binName}.exe`)
  copyFileSync(src, dest)
  console.log(`\n[installer] ${dest}`)
  return dest
}
