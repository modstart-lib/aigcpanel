#!/usr/bin/env bash
#
# Fetch the ffmpeg / ffprobe binaries used by AIGCPanel.
#
# Binaries live in https://github.com/modstart-lib/share-binary, one folder per
# platform/arch: osx-arm64, osx-x86, linux-arm64, linux-x86, win-x86.
# The whole repository is ~927 MiB of binaries (~225 MB over the wire), so by
# default we use a partial clone (--filter=blob:none) plus sparse-checkout to
# transfer only the two files of the current platform/arch (~22 MB).
#
# Usage:
#   bash scripts/init.sh                    # current platform/arch only (default)
#   bash scripts/init.sh --arch osx-arm64   # explicit platform folder (repeatable)
#   bash scripts/init.sh --all              # every platform (release builds)
#   bash scripts/init.sh --fresh            # delete the local clone and re-clone
#   bash scripts/init.sh --offline          # keep local files, no network
#
# Environment:
#   ARCHES="osx-arm64 win-x86"  same as --arch (space or comma separated)
#   TARGET_ARCH=x64|arm64       cross-build target, mirrors gen-electron-builder-config.mjs
#   INIT_LOG=path               log file (default: share-binary-init.log)
#   SHARE_BINARY_REPO_URL=url   clone from a mirror instead of GitHub
#   INIT_DEBUG=1                enable GIT_TRACE / GIT_CURL_VERBOSE for network issues
#
# Everything is written to the terminal and to the log file. When a build on a
# new platform misbehaves, attach that log file.

# Re-exec once, piping everything through tee into the log file. The re-exec
# keeps `set -e` fully active for the real run (a plain pipeline would disable
# errexit inside it), and gives the parent the real exit code via PIPESTATUS.
if [ "${AIGCPANEL_INIT_LOG_WRAPPED:-0}" != "1" ] &&
    [ "${1:-}" != "-h" ] && [ "${1:-}" != "--help" ]; then
    _log="${INIT_LOG:-share-binary-init.log}"
    AIGCPANEL_INIT_LOG_WRAPPED=1 bash "$0" "$@" 2>&1 | tee "$_log"
    _code=${PIPESTATUS[0]}
    if [ "$_code" -ne 0 ]; then
        printf '%s [ERROR] 失败（退出码 %s），请把日志文件 %s 全文贴出来\n' \
            "$(date '+%Y-%m-%d %H:%M:%S')" "$_code" "$_log" >&2
    else
        printf '%s [INFO ] 完整日志已保存到 %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$_log"
    fi
    exit "$_code"
fi

set -Eeuo pipefail

REPO_URL="${SHARE_BINARY_REPO_URL:-https://github.com/modstart-lib/share-binary}"
BRANCH="main"
REPO_DIR="share-binary"
DEST_ROOT="electron/resources/extra"
ALL_ARCHES="osx-arm64 osx-x86 linux-arm64 linux-x86 win-x86"

LOG_FILE="${INIT_LOG:-share-binary-init.log}"
ARCHES="${ARCHES:-}"
FRESH=0
OFFLINE=0
FILTER_OK=1
SPARSE_CLI_OK=1
PENDING_UPDATE=0

# ── logging helpers ───────────────────────────────────────────────
ts() { date '+%Y-%m-%d %H:%M:%S'; }
log() { printf '%s [INFO ] %s\n' "$(ts)" "$*"; }
warn() { printf '%s [WARN ] %s\n' "$(ts)" "$*" >&2; }
err() { printf '%s [ERROR] %s\n' "$(ts)" "$*" >&2; }
step() { printf '\n%s [STEP ] ===== %s =====\n' "$(ts)" "$*"; }
die() {
    err "$*"
    trap - ERR
    exit 1
}
have() { command -v "$1" >/dev/null 2>&1; }

usage() {
    # Print the header comment block (everything between the shebang and code).
    awk 'NR > 2 { if ($0 == "") exit; sub(/^# ?/, ""); print }' "$0"
}

# ── small utilities ───────────────────────────────────────────────
version_at_least() { # $1=current version string, $2=minimum "x.y"
    local cur_major cur_minor min_major min_minor
    cur_major="${1%%.*}"
    cur_minor="${1#*.}"
    cur_minor="${cur_minor%%.*}"
    min_major="${2%%.*}"
    min_minor="${2#*.}"
    [ "${cur_major:-0}" -gt "$min_major" ] && return 0
    [ "${cur_major:-0}" -eq "$min_major" ] && [ "${cur_minor:-0}" -ge "$min_minor" ]
}

sha256_of() {
    if have sha256sum; then
        sha256sum "$1" | awk '{print $1}'
    elif have shasum; then
        shasum -a 256 "$1" | awk '{print $1}'
    elif have openssl; then
        openssl dgst -sha256 "$1" | awk '{print $NF}'
    else
        echo ""
    fi
}

file_size() { wc -c <"$1" | tr -d ' '; }

bin_suffix() { # windows folders carry .exe binaries
    case "$1" in
    win-*) echo ".exe" ;;
    *) echo "" ;;
    esac
}

# ── platform mapping ──────────────────────────────────────────────
map_arch() { # $1=uname -s, $2=uname -m -> repository folder name
    local os="$1" machine="$2"
    case "$os" in
    Darwin)
        case "$machine" in
        arm64 | aarch64) echo "osx-arm64" ;;
        x86_64 | amd64) echo "osx-x86" ;;
        esac
        ;;
    Linux)
        case "$machine" in
        aarch64 | arm64) echo "linux-arm64" ;;
        x86_64 | amd64) echo "linux-x86" ;;
        esac
        ;;
    MINGW* | MSYS* | CYGWIN* | Windows_NT)
        # The repository only ships a win-x86 folder; it holds the x64 build too.
        echo "win-x86"
        ;;
    esac
}

detect_arch() {
    local os machine folder
    DETECTED_ARCH=""
    os="$(uname -s)"
    machine="$(uname -m)"
    log "uname: $(uname -srm 2>/dev/null || echo "$os $machine")"
    log "bash: ${BASH_VERSION:-unknown}"

    if [ -n "${TARGET_ARCH:-}" ]; then
        case "$TARGET_ARCH" in
        arm64) machine="arm64" ;;
        x64) machine="x86_64" ;;
        *) warn "TARGET_ARCH=$TARGET_ARCH 不是 arm64/x64，按本机架构处理" ;;
        esac
        log "TARGET_ARCH=${TARGET_ARCH}（交叉构建目标，参与架构映射）"
    fi

    folder="$(map_arch "$os" "$machine")"
    if [ -z "$folder" ]; then
        return 1
    fi
    if [ "$folder" = "win-x86" ] && [ "$machine" != "x86_64" ] && [ "$machine" != "amd64" ]; then
        warn "Windows 平台没有 $machine 的独立目录，回退到 win-x86（内含 x64 构建）"
    fi
    DETECTED_ARCH="$folder"
}

validate_arches() {
    local a
    for a in $ARCHES; do
        case " $ALL_ARCHES " in
        *" $a "*) ;;
        *) die "未知平台目录 '$a'，可用: $ALL_ARCHES" ;;
        esac
    done
}

dedupe_arches() {
    local out="" a
    for a in $ARCHES; do
        case " $out " in
        *" $a "*) ;;
        *) out="${out:+$out }$a" ;;
        esac
    done
    ARCHES="$out"
}

build_patterns() {
    PATTERNS=()
    local a
    for a in $ARCHES; do
        if [ "$(bin_suffix "$a")" = ".exe" ]; then
            PATTERNS+=("/$a/ffmpeg.exe" "/$a/ffprobe.exe")
        else
            PATTERNS+=("/$a/ffmpeg" "/$a/ffprobe")
        fi
    done
}

# ── steps ─────────────────────────────────────────────────────────
check_env() {
    require_root
    have git || die "找不到 git，请先安装 git"
    log "git: $(git --version 2>&1)"

    local gv
    gv="$(git --version 2>/dev/null | awk '{print $3}')"
    if ! version_at_least "$gv" "2.19"; then
        FILTER_OK=0
        warn "git $gv < 2.19：服务端 blob 过滤（省流量）不可用，将下载全部二进制"
    fi
    if ! version_at_least "$gv" "2.25"; then
        SPARSE_CLI_OK=0
        warn "git $gv < 2.25：没有 sparse-checkout 子命令，改用 .git/info/sparse-checkout 兜底"
    fi
    if [ "$FILTER_OK" = 1 ]; then
        log "partial clone 可用：只按需拉取 blob"
    else
        warn "将下载全部二进制（约 225 MB）：升级 git 后可用 partial clone 省流量"
    fi
    if [ "$OFFLINE" = 1 ]; then
        # git >= 2.36: fail on missing blobs instead of silently fetching them.
        export GIT_NO_LAZY_FETCH=1
        log "--offline：禁止一切网络访问（缺少的 blob 会直接报错）"
    fi
    if [ "${INIT_DEBUG:-0}" = "1" ]; then
        warn "INIT_DEBUG=1：开启 GIT_TRACE / GIT_CURL_VERBOSE，输出会非常长"
        export GIT_TRACE=1
        export GIT_CURL_VERBOSE=1
    fi
}

require_root() {
    log "工作目录: $(pwd)"
    [ -f "electron-builder.json5" ] ||
        die "请在项目根目录执行（当前缺少 electron-builder.json5）"
}

resolve_arches() {
    if [ -n "$ARCHES" ]; then
        ARCHES="$(printf '%s' "$ARCHES" | tr ',' ' ')"
        log "使用指定的平台目录: $ARCHES"
    else
        if ! detect_arch; then
            die "无法识别当前平台架构，请用 --arch 手动指定（${ALL_ARCHES}）"
        fi
        ARCHES="$DETECTED_ARCH"
        log "自动识别当前平台目录: $ARCHES"
        log "（可用 --arch 或 ARCHES 覆盖，--all 获取全部平台）"
    fi
    validate_arches
    dedupe_arches
    log "最终目标平台目录: $ARCHES"
}

sync_repo() {
    if [ -d "$REPO_DIR/.git" ]; then
        log "检测到已有仓库: $REPO_DIR"
        local origin
        origin="$(git -C "$REPO_DIR" remote get-url origin 2>/dev/null || true)"
        log "origin: ${origin:-<未配置>}"
        if [ -z "$origin" ]; then
            die "$REPO_DIR 存在但没有配置 origin，请用 --fresh 重新克隆"
        fi
        case "${origin%.git}" in
        "$REPO_URL") ;;
        *) warn "origin 与预期不同（期望 ${REPO_URL}），继续使用本地仓库" ;;
        esac

        local filter
        filter="$(git -C "$REPO_DIR" config --get remote.origin.partialclonefilter || true)"
        if [ -n "$filter" ]; then
            log "本地是 partial clone（filter=${filter}），只按需补拉 blob"
        else
            warn "本地是完整克隆（未启用 blob 过滤），本次复用已有对象，不会重新下载整仓"
            warn "如需最小体积：rm -rf $REPO_DIR && bash scripts/init.sh --fresh"
        fi
        update_repo
    else
        if [ -e "$REPO_DIR" ]; then
            die "$REPO_DIR 已存在但不是 git 仓库，请用 --fresh 覆盖"
        fi
        if [ "$OFFLINE" = 1 ]; then
            die "--offline 需要已存在的 $REPO_DIR"
        fi
        clone_repo
    fi
}

clone_repo() {
    local filter_arg=()
    if [ "$FILTER_OK" = 1 ]; then
        filter_arg=(--filter=blob:none)
    fi

    if [ "$SPARSE_CLI_OK" = 1 ]; then
        log "\$ git clone --sparse --depth 1 --progress ${filter_arg[*]:-} $REPO_URL $REPO_DIR"
        if git clone --sparse --depth 1 --progress "${filter_arg[@]}" "$REPO_URL" "$REPO_DIR"; then
            return 0
        fi
        if [ "${#filter_arg[@]}" -gt 0 ]; then
            warn "partial clone 失败（服务器或代理可能不支持 filter=blob:none），回退为普通 shallow clone"
            warn "回退后需要下载全部二进制，约 225 MB，请耐心等待"
            rm -rf "$REPO_DIR"
            log "\$ git clone --sparse --depth 1 --progress $REPO_URL $REPO_DIR"
            git clone --sparse --depth 1 --progress "$REPO_URL" "$REPO_DIR" ||
                die "克隆失败，请检查网络或代理（可设置 INIT_DEBUG=1 查看细节）"
        else
            die "克隆失败，请检查网络或代理（可设置 INIT_DEBUG=1 查看细节）"
        fi
    else
        log "\$ git clone --no-checkout --depth 1 --progress ${filter_arg[*]:-} $REPO_URL $REPO_DIR"
        git clone --no-checkout --depth 1 --progress "${filter_arg[@]}" "$REPO_URL" "$REPO_DIR" ||
            die "克隆失败，请检查网络或代理（可设置 INIT_DEBUG=1 查看细节）"
    fi
}

update_repo() {
    if [ "$OFFLINE" = 1 ]; then
        warn "--offline：跳过 fetch，直接使用本地已有文件"
        return 0
    fi
    log "拉取 $BRANCH 最新提交（shallow，仅元数据；二进制稍后按需补拉）..."
    if git -C "$REPO_DIR" fetch --depth 1 --progress origin "$BRANCH"; then
        PENDING_UPDATE=1
        log "fetch 完成: $(git -C "$REPO_DIR" rev-parse --short FETCH_HEAD 2>/dev/null || echo '?')"
    else
        warn "fetch 失败（网络/代理/镜像不支持 filter？），继续使用本地已有副本"
        warn "如需强制更新，解决网络后重试或使用 --fresh"
    fi
}

checkout_update() {
    if [ "$PENDING_UPDATE" != 1 ]; then
        log "无需切换提交（已是最新或离线）"
        return 0
    fi
    # Sparse patterns are already in place, so this only pulls the binaries we want.
    log "\$ git -C $REPO_DIR reset --hard FETCH_HEAD"
    git -C "$REPO_DIR" reset --hard FETCH_HEAD >/dev/null
    log "已切换到 $(git -C "$REPO_DIR" rev-parse --short HEAD) ($(git -C "$REPO_DIR" log -1 --format='%cd' --date=short))"
}

apply_sparse() {
    local p file_paths=()
    log "需要的文件:"
    for p in "${PATTERNS[@]}"; do
        log "  - ${p#/}"
        file_paths+=("${p#/}")
    done

    if [ "$SPARSE_CLI_OK" = 1 ]; then
        log "\$ git -C $REPO_DIR sparse-checkout set --no-cone ${PATTERNS[*]}"
        log "这一步按需下载所需 blob（网络慢时会停留在这里，属正常）"
        git -C "$REPO_DIR" sparse-checkout set --no-cone "${PATTERNS[@]}" ||
            die "sparse-checkout 失败（见上方 git 输出）：网络/代理中断、--offline 下缺少所需 blob，或代理不支持 partial clone"
    else
        manual_sparse
        log "\$ git -C $REPO_DIR read-tree -mu HEAD"
        git -C "$REPO_DIR" read-tree -mu HEAD >/dev/null
    fi

    # A previously failed run can leave these paths deleted from the worktree
    # while the index still considers them up to date; force them out again.
    log "\$ git -C $REPO_DIR checkout -f HEAD -- ${file_paths[*]}"
    git -C "$REPO_DIR" checkout -f HEAD -- "${file_paths[@]}" ||
        die "检出 ${file_paths[*]} 失败（网络/代理中断，或 --offline 下缺少所需 blob）"

    log "已检出文件数: $(find "$REPO_DIR" -type f -not -path "$REPO_DIR/.git/*" | wc -l | tr -d ' ')"
    if have du; then
        log "仓库 .git 体积: $(du -sh "$REPO_DIR/.git" 2>/dev/null | awk '{print $1}')（越小说明省下的流量越多）"
    fi
}

manual_sparse() {
    log "写入 $REPO_DIR/.git/info/sparse-checkout"
    git -C "$REPO_DIR" config core.sparseCheckout true
    git -C "$REPO_DIR" config core.sparseCheckoutCone false
    printf '%s\n' "${PATTERNS[@]}" >"$REPO_DIR/.git/info/sparse-checkout"
}

show_repo_state() {
    log "commit: $(git -C "$REPO_DIR" rev-parse HEAD 2>/dev/null || echo '?')"
    log "索引文件数: $(git -C "$REPO_DIR" ls-files | wc -l | tr -d ' ')（含未检出）"
    log "已检出文件数: $(find "$REPO_DIR" -type f -not -path "$REPO_DIR/.git/*" | wc -l | tr -d ' ')"
    if have du; then
        log "磁盘占用: 仓库 $(du -sh "$REPO_DIR" 2>/dev/null | awk '{print $1}')（其中 .git $(du -sh "$REPO_DIR/.git" 2>/dev/null | awk '{print $1}')）"
    fi
}

copy_bins() {
    local arch suffix destdir tool src dst
    for arch in $ARCHES; do
        suffix="$(bin_suffix "$arch")"
        destdir="$DEST_ROOT/$arch"
        log "→ $arch"
        for tool in ffmpeg ffprobe; do
            src="$REPO_DIR/$arch/$tool$suffix"
            if [ ! -f "$src" ]; then
                die "缺少 ${src}（sparse-checkout 未生效？可加 --fresh 重试）"
            fi
        done
        rm -rf "$destdir"
        mkdir -p "$destdir"
        for tool in ffmpeg ffprobe; do
            src="$REPO_DIR/$arch/$tool$suffix"
            dst="$destdir/$tool$suffix"
            log "  cp -a $src -> $dst"
            cp -a "$src" "$dst"
            chmod +x "$dst" 2>/dev/null || true
            if [ "$(file_size "$src")" != "$(file_size "$dst")" ]; then
                die "复制后大小不一致: ${dst}（源 $(file_size "$src") 字节，目标 $(file_size "$dst") 字节）"
            fi
        done
        if have ls; then
            ls -l "$destdir" 2>/dev/null | sed 's/^/  /'
        fi
    done
}

report() {
    local arch suffix tool f disk_size sha expected

    log "二进制清单（对照 git 内记录的大小，可发现截断/损坏）:"
    for arch in $ARCHES; do
        suffix="$(bin_suffix "$arch")"
        for tool in ffmpeg ffprobe; do
            f="$DEST_ROOT/$arch/$tool$suffix"
            [ -f "$f" ] || die "复制后缺少 $f"
            disk_size="$(file_size "$f")"
            expected="$(git -C "$REPO_DIR" ls-tree -l HEAD -- "$arch/$tool$suffix" 2>/dev/null | awk '{print $4}')"
            sha="$(sha256_of "$f")"
            log "  $f"
            log "      size=${disk_size} bytes (git: ${expected:-unknown})  sha256=${sha:-<unavailable>}"
            if [ -n "$expected" ] && [ "$expected" != "$disk_size" ]; then
                warn "大小与仓库记录不一致: $f"
            fi
            if have file; then
                log "      type=$(file -b "$f" 2>/dev/null || echo unknown)"
            fi
        done
    done

    log "目标目录树:"
    if have ls; then
        ls -R "$DEST_ROOT" 2>/dev/null | sed 's/^/  /'
    fi

    if have du; then
        log "总占用: 目标目录 $(du -sh "$DEST_ROOT" 2>/dev/null | awk '{print $1}') / 仓库 $(du -sh "$REPO_DIR" 2>/dev/null | awk '{print $1}')（其中 .git $(du -sh "$REPO_DIR/.git" 2>/dev/null | awk '{print $1}')）"
    fi
}

summary() {
    cat <<EOF

========== 摘要（反馈问题时请附本日志）==========
时间      : $(ts)
系统      : $(uname -srm 2>/dev/null || uname -a)
git       : $(git --version 2>/dev/null || echo '?')
平台目录  : $ARCHES
仓库      : $REPO_DIR @ $(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo '?')
日志文件  : $LOG_FILE
提示:
  - 只给某个平台取二进制: bash scripts/init.sh --arch osx-x86
  - 发布需要全部平台      : bash scripts/init.sh --all
  - 恢复完整工作区        : git -C $REPO_DIR sparse-checkout disable
  - 彻底重建              : bash scripts/init.sh --fresh
=================================================

EOF
}

main() {
    trap on_error ERR

    while [ $# -gt 0 ]; do
        case "$1" in
        --arch)
            shift
            [ $# -gt 0 ] || die "--arch 需要一个平台目录名（${ALL_ARCHES}）"
            ARCHES="${ARCHES:+$ARCHES }$1"
            shift
            ;;
        --all)
            ARCHES="$ALL_ARCHES"
            shift
            ;;
        --fresh)
            FRESH=1
            shift
            ;;
        --offline)
            OFFLINE=1
            shift
            ;;
        -h | --help)
            usage
            exit 0
            ;;
        *)
            die "未知参数: ${1}（--help 查看用法）"
            ;;
        esac
    done

    step "1/7 环境检查"
    check_env

    step "2/7 平台与目标架构"
    resolve_arches
    build_patterns

    step "3/7 同步 share-binary 仓库"
    if [ "$FRESH" = 1 ] && [ -d "$REPO_DIR" ]; then
        warn "--fresh：删除已存在的 $REPO_DIR"
        rm -rf "$REPO_DIR"
    fi
    sync_repo

    step "4/7 应用 sparse-checkout（只下载所需的二进制）"
    apply_sparse

    step "5/7 检出目标提交"
    checkout_update
    show_repo_state

    step "6/7 复制到 $DEST_ROOT"
    copy_bins

    step "7/7 校验与汇总"
    report
    summary
}

on_error() {
    local code=$?
    err "脚本失败：退出码 ${code}，第 ${BASH_LINENO[0]:-?} 行，命令: ${BASH_COMMAND}"
}

main "$@"
