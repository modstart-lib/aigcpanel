import fs from "node:fs";
import {defineConfig} from "vite";
import vue from "@vitejs/plugin-vue";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import pkg from "./package.json";
import path from "node:path";
import {AppConfig} from "./src/config";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

// https://vitejs.dev/config/
export default defineConfig(({command}) => {
    fs.rmSync("dist-electron", {recursive: true, force: true});

    const isServe = command === "serve";
    const isBuild = command === "build";
    const sourcemap = isServe || !!process.env.VSCODE_DEBUG;
    const minify = isBuild && !process.env.VSCODE_DEBUG;

    const externalPackages = [
        ...Object.keys("dependencies" in pkg ? pkg.dependencies : {}),
        ...Object.keys("devDependencies" in pkg ? pkg.devDependencies : {}),
        ...Object.keys("optionalDependencies" in pkg ? pkg.optionalDependencies : {}),
    ];

    return {
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
                    },
                },
            }),
            {
                name: "add-build-time",
                generateBundle() {
                    const buildId = dayjs().tz("Asia/Shanghai").format("YYYYMMDDHHmmss");
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
        server:
            process.env.VSCODE_DEBUG &&
            (() => {
                const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL);
                return {
                    host: url.hostname,
                    port: +url.port,
                };
            })(),
    };
});
