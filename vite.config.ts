import vue from "@vitejs/plugin-vue";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import IconsResolver from "unplugin-icons/resolver";
import Icons from "unplugin-icons/vite";
import Components from "unplugin-vue-components/vite";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import pkg from "./package.json";
import { AppConfig } from "./src/config";
import { loadDotEnv } from "./test/helpers/env";

const _require = createRequire(import.meta.url);
const mdiIcons = _require("@iconify-json/mdi/icons.json");

dayjs.extend(utc);
dayjs.extend(timezone);

// https://vitejs.dev/config/
export default defineConfig(({command}) => {
    fs.rmSync("dist-electron", {recursive: true, force: true});

    // 开发环境启动时自动加载 .env 到 process.env（正式发布构建不加载）
    if (process.env.VITE_RELEASE !== "1") {
        const envCount = loadDotEnv();
        if (envCount > 0) {
            console.log(`[env] 已从 .env 加载 ${envCount} 个环境变量`);
        }
    }

    const isServe = command === "serve";
    const isBuild = command === "build";
    const sourcemap = isServe || !!process.env.VSCODE_DEBUG ? true : 'hidden';
    const minify = isBuild && !process.env.VSCODE_DEBUG;
    const _platformMap: Record<string, string> = { win32: "win", darwin: "osx", linux: "linux" };
    const _archMap: Record<string, string> = { x64: "x64", arm64: "arm64", ia32: "x86" };
    const _platform = _platformMap[process.platform] ?? process.platform;
    const _arch = _archMap[process.arch] ?? process.arch;
    const buildId = `${_platform}-${_arch}-${dayjs().tz("Asia/Shanghai").format("YYYYMMDDHHmmss")}`;

    const externalPackages = [
        ...Object.keys("dependencies" in pkg ? pkg.dependencies : {}),
        ...Object.keys("devDependencies" in pkg ? pkg.devDependencies : {}),
        ...Object.keys("optionalDependencies" in pkg ? pkg.optionalDependencies : {}),
    ];

    return {
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "src"),
            },
        },
        plugins: [
            vue({
                template: {
                    compilerOptions: {
                        isCustomElement: tag => {
                            if (["webview"].includes(tag)) {
                                return true;
                            }
                            return false;
                        },
                        nodeTransforms: process.env.VITE_RELEASE === '1' ? [
                            (node: any) => {
                                if (node.type === 1 && Array.isArray(node.props)) {
                                    node.props = node.props.filter((p: any) =>
                                        !(p.type === 6 && p.name === 'data-auto-test-id')
                                    );
                                }
                            },
                        ] : [],
                    },
                },
            }),
            Icons({
                compiler: "vue3",
                customCollections: {
                    mdi: () => mdiIcons as any,
                },
            }),
            Components({
                resolvers: [
                    IconsResolver({
                        prefix: "i",
                    }),
                ],
                dts: false,
            }),
            {
                name: "add-build-time",
                generateBundle() {
                    this.emitFile({
                        type: "asset",
                        fileName: "build.json",
                        source: JSON.stringify(
                            {
                                buildId,
                            },
                            null,
                            2
                        ),
                    });
                },
            },
            {
                name: "process-variables",
                closeBundle() {
                    const files = [
                        "splash.html",
                        "index.html",
                        "page/about.html",
                        "page/feedback.html",
                        "page/guide.html",
                        "page/monitor.html",
                        "page/payment.html",
                        "page/setup.html",
                        "page/user.html",
                        "page/log.html",
                    ];
                    files.forEach(f => {
                        const p = path.resolve(__dirname, "dist", f);
                        if(!fs.existsSync(p)) {
                            return;
                        }
                        let html = fs.readFileSync(p, "utf-8");
                        for (const key in AppConfig) {
                            html = html.replace(new RegExp(`%${key}%`, "g"), AppConfig[key]);
                        }
                        fs.writeFileSync(p, html, "utf-8");
                    });
                },
            },
            electron([
                {
                    // Shortcut of `build.lib.entry`
                    entry: "electron/main/index.ts",
                    onstart({startup}) {
                        if (process.env.VSCODE_DEBUG) {
                            console.log(/* For `.vscode/.debug.script.mjs` */ "[startup] Electron App");
                        } else {
                            startup();
                        }
                    },
                    vite: {
                        define: {
                            __BUILD_ID__: JSON.stringify(buildId),
                        },
                        build: {
                            sourcemap,
                            minify: minify,
                            outDir: "dist-electron/main",
                            rollupOptions: {
                                // Some third-party Node.js libraries may not be built correctly by Vite, especially `C/C++` addons,
                                // we can use `external` to exclude them to ensure they work correctly.
                                // Others need to put them in `dependencies` to ensure they are collected into `app.asar` after the app is built.
                                // Of course, this is not absolute, just this way is relatively simple. :)
                                external: externalPackages,
                            },
                        },
                    },
                },
                {
                    // Shortcut of `build.rollupOptions.input`.
                    // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                    entry: "electron/preload/index.ts",
                    onstart({reload}) {
                        // Notify the Renderer process to reload the page when the Preload scripts build is complete,
                        // instead of restarting the entire Electron App.
                        reload();
                    },
                    vite: {
                        build: {
                            target: "es2015",
                            sourcemap: undefined, // #332
                            minify: minify,
                            outDir: "dist-electron/preload",
                            lib: {
                                formats: ["cjs"],
                                fileName: "index",
                            },
                            rollupOptions: {
                                external: externalPackages,
                                output: {
                                    format: "cjs",
                                    // entryFileNames: '[name].cjs',
                                    strict: true,
                                },
                            },
                        },
                    },
                },
            ]),
            renderer(),
        ],
        define: {
            __BUILD_ID__: JSON.stringify(buildId),
        },
        build: {
            sourcemap: sourcemap,
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, "index.html"),
                    about: path.resolve(__dirname, "page/about.html"),
                    feedback: path.resolve(__dirname, "page/feedback.html"),
                    user: path.resolve(__dirname, "page/user.html"),
                    guide: path.resolve(__dirname, "page/guide.html"),
                    setup: path.resolve(__dirname, "page/setup.html"),
                    payment: path.resolve(__dirname, "page/payment.html"),
                    monitor: path.resolve(__dirname, "page/monitor.html"),
                    log: path.resolve(__dirname, "page/log.html"),
                },
            },
        },
        server: process.env.VSCODE_DEBUG
            ? (() => {
                const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
                return {
                    host: url.hostname,
                    port: +url.port,
                };
            })()
            : {
                host: "127.0.0.1",
                port: 53021,
            },
    };
});
