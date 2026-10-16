import StorageMain from "../storage/main";
import Files from "../file/main";

const versions = [
    {
        version: 0,
        up: async (db: DB) => {
            // await db.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`);
            // console.log('db.insert', await db.insert(`INSERT INTO users (name, email) VALUES (?, ?)`,['Alice', 'alice@example.com']));
            // console.log('db.select', await db.select(`SELECT * FROM users`));
            // console.log('db.first', await db.first(`SELECT * FROM users`));
        },
    },
    {
        version: 1,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_sound_tts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    serverName TEXT, serverTitle TEXT, serverVersion TEXT,
                    text TEXT, param TEXT,
                    status TEXT, statusMsg TEXT, jobResult TEXT,
                    startTime INTEGER, endTime INTEGER, resultWav TEXT
            )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS data_sound_clone (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    serverName TEXT, serverTitle TEXT, serverVersion TEXT,
                    promptName TEXT, promptWav TEXT, promptText TEXT,
                    text TEXT, param TEXT,
                    status TEXT, statusMsg TEXT, jobResult TEXT,
                    startTime INTEGER, endTime INTEGER, resultWav TEXT
            )`);
            await db.execute(
                `CREATE TABLE IF NOT EXISTS data_video_template (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, video TEXT)`,
            );
            await db.execute(`CREATE TABLE IF NOT EXISTS data_video_gen (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    serverName TEXT, serverTitle TEXT, serverVersion TEXT,
                    videoTemplateId INTEGER, videoTemplateName TEXT,
                    soundType TEXT, soundTtsId INTEGER, soundTtsText TEXT,
                    soundCloneId INTEGER, soundCloneText TEXT, param TEXT,
                    status TEXT, statusMsg TEXT, jobResult TEXT,
                    startTime INTEGER, endTime INTEGER, resultMp4 TEXT
            )`);
        },
    },
    {
        version: 2,
        up: async (db: DB) => {
            await db.execute(
                `ALTER TABLE data_sound_tts ADD COLUMN result TEXT`,
            );
            await db.execute(
                `ALTER TABLE data_sound_clone ADD COLUMN result TEXT`,
            );
            await db.execute(
                `ALTER TABLE data_video_gen ADD COLUMN result TEXT`,
            );
        },
    },
    {
        version: 3,
        up: async (db: DB) => {
            await db.execute(
                `ALTER TABLE data_video_gen ADD COLUMN soundCustomFile TEXT`,
            );
        },
    },
    {
        version: 4,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_task (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   createdAt INTEGER DEFAULT (strftime('%s', 'now')),
                   updatedAt INTEGER DEFAULT (strftime('%s', 'now')),
                   biz TEXT,
                   status TEXT, statusMsg TEXT, startTime INTEGER, endTime INTEGER,
                   serverName TEXT, serverTitle TEXT, serverVersion TEXT,
                   param TEXT, jobResult TEXT, modelConfig TEXT, result TEXT
            )`);
        },
    },
    {
        version: 5,
        up: async (db: DB) => {
            // await db.execute(`DELETE FROM data_task where 1=1`);
            // SoundClone
            let records = await db.select(`SELECT * FROM data_sound_clone`);
            for (const r of records) {
                const values = [
                    "SoundClone",
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    r.param,
                    r.jobResult,
                    JSON.stringify({
                        promptName: r.promptName,
                        promptWav: r.promptWav,
                        promptText: r.promptText,
                        text: r.text,
                    }),
                    JSON.stringify({ url: r.resultWav }),
                ];
                await db.insert(
                    `INSERT INTO data_task
                    (biz, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    values,
                );
            }
            // SoundTts
            records = await db.select(`SELECT * FROM data_sound_tts`);
            for (const r of records) {
                const values = [
                    "SoundTts",
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    r.param,
                    r.jobResult,
                    JSON.stringify({ text: r.text }),
                    JSON.stringify({ url: r.resultWav }),
                ];
                await db.insert(
                    `INSERT INTO data_task
                                 (biz, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    values,
                );
            }
            // VideoGen
            records = await db.select(`SELECT * FROM data_video_gen`);
            for (const r of records) {
                const values = [
                    "VideoGen",
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    r.param,
                    r.jobResult,
                    JSON.stringify({
                        videoTemplateId: r.videoTemplateId,
                        videoTemplateName: r.videoTemplateName,
                        soundType: r.soundType,
                        soundTtsId: r.soundTtsId,
                        soundTtsText: r.soundTtsText,
                        soundCloneId: r.soundCloneId,
                        soundCloneText: r.soundCloneText,
                        soundCustomFile: r.soundCustomFile,
                    }),
                    JSON.stringify({ url: r.resultMp4 }),
                ];
                await db.insert(
                    `INSERT INTO data_task
                                 (biz, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    values,
                );
            }
        },
    },
    {
        version: 6,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_storage (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   createdAt INTEGER DEFAULT (strftime('%s', 'now')),
                   updatedAt INTEGER DEFAULT (strftime('%s', 'now')),
                   biz TEXT, title TEXT, sort INTEGER, content TEXT
            )`);
        },
    },
    {
        version: 7,
        up: async (db: DB) => {
            const records = await StorageMain.get(
                "soundClonePrompt",
                "records",
                [],
            );
            for (const r of records) {
                const values = [
                    "SoundPrompt",
                    r.name,
                    JSON.stringify({
                        url: r.promptWav,
                        promptText: r.promptText,
                    }),
                ];
                await db.insert(
                    `INSERT INTO data_storage (biz, title, content)
                                 VALUES (?, ?, ?)`,
                    values,
                );
            }
        },
    },
    {
        version: 8,
        up: async (db: DB) => {
            await db.execute(`ALTER TABLE data_task ADD COLUMN title TEXT`);
            const records = await db.select(`SELECT * FROM data_task`);
            for (const r of records) {
                let modelConfig: any = {};
                try {
                    modelConfig = JSON.parse(r.modelConfig);
                } catch (e) {
                    modelConfig = {};
                }
                let title = "";
                if (r.biz === "SoundTts" || r.biz === "SoundClone") {
                    title = Files.textToName(modelConfig.text);
                } else if (r.biz === "VideoGen") {
                    title = Files.textToName(
                        [
                            modelConfig.videoTemplateName,
                            modelConfig.soundTtsText,
                        ].join("_"),
                    );
                } else if (r.biz === "VideoGenFlow") {
                    title = Files.textToName(
                        [modelConfig.videoTemplateName, modelConfig.text].join(
                            "_",
                        ),
                    );
                }
                await db.execute(
                    `UPDATE data_task SET title = ? WHERE id = ?`,
                    [title, r.id],
                );
            }
        },
    },
    {
        version: 9,
        up: async (db: DB) => {
            const records = await db.select(
                `SELECT * FROM data_task where biz in ('SoundTts', 'SoundClone')`,
            );
            for (const r of records) {
                const modelConfigOld = JSON.parse(r.modelConfig);
                const paramOld = JSON.parse(r.param);
                const modelConfig: any = {
                    type: r.biz,
                    ttsParam: r.biz === "SoundTts" ? paramOld : undefined,
                    cloneParam: r.biz === "SoundClone" ? paramOld : undefined,
                    ...modelConfigOld,
                };
                const values = [
                    "SoundGenerate",
                    r.title,
                    r.status,
                    r.statusMsg,
                    r.startTime,
                    r.endTime,
                    r.serverName,
                    r.serverTitle,
                    r.serverVersion,
                    JSON.stringify({}),
                    r.jobResult,
                    JSON.stringify(modelConfig),
                    r.result,
                ];
                await db.insert(
                    `INSERT INTO data_task
                                 (biz, title, status, statusMsg, startTime, endTime, serverName, serverTitle, serverVersion, param, jobResult, modelConfig,  result)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    values,
                );
                await db.execute(`DELETE FROM data_task WHERE id = ?`, [r.id]);
            }
        },
    },
    {
        version: 10,
        up: async (db: DB) => {
            await db.execute(
                `ALTER TABLE data_task ADD COLUMN type INTEGER DEFAULT 1`,
            );
        },
    },
    {
        version: 11,
        up: async (db: DB) => {
            await db.execute(
                `ALTER TABLE data_video_template ADD COLUMN info TEXT`,
            );
        },
    },
    {
        version: 12,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS workflow
                              (
                                  id        INTEGER PRIMARY KEY AUTOINCREMENT,
                                  createdAt INTEGER DEFAULT (strftime('%s', 'now')),
                                  updatedAt INTEGER DEFAULT (strftime('%s', 'now')),
                                  name      TEXT,
                                  data      TEXT,
                                  thumb     TEXT
                              )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS workflow_log
                              (
                                  id          INTEGER PRIMARY KEY AUTOINCREMENT,
                                  createdAt   INTEGER DEFAULT (strftime('%s', 'now')),
                                  updatedAt   INTEGER DEFAULT (strftime('%s', 'now')),
                                  workflowId  INTEGER,
                                  name        TEXT,
                                  seqId       INTEGER,
                                  pauseByType TEXT,
                                  pauseById   TEXT,
                                  data        TEXT,
                                  status      TEXT,
                                  statusMsg   TEXT,
                                  startTime   INTEGER,
                                  endTime     INTEGER
                              )`);
        },
    },
    {
        version: 13,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS live_avatar (
                   id INTEGER PRIMARY KEY AUTOINCREMENT,
                   createdAt INTEGER DEFAULT (strftime('%s', 'now')),
                   updatedAt INTEGER DEFAULT (strftime('%s', 'now')),
                   name TEXT,
                   video TEXT,
                   info TEXT
            )`);
        },
    },
    {
        version: 14,
        up: async (db: DB) => {
            await db.execute(`DROP TABLE IF EXISTS data_video_gen`);
            await db.execute(`DROP TABLE IF EXISTS data_sound_tts`);
            await db.execute(`DROP TABLE IF EXISTS data_sound_clone`);
        },
    },
    {
        version: 15,
        up: async (db: DB) => {
            // Migrate the legacy clone voice library (data_storage biz "SoundPrompt",
            // migrated from the old "soundClonePrompt" storage) into the new voice
            // store ("SoundVoice"), so cloned voices saved before the voice refactor
            // are visible again in the new voice management UI.
            //
            // Legacy records only carry the reference audio + text; they have no
            // model binding, so serverKey is left empty and must be chosen by the
            // user in the voice management page before the voice can be used.
            // The original SoundPrompt rows are kept (still used by custom params).
            const records = await db.select(
                `SELECT * FROM data_storage WHERE biz = ?`,
                ["SoundPrompt"],
            );
            // Idempotent guard: collect titles already present in SoundVoice so a
            // re-run (or a manually recreated voice) does not insert duplicates.
            // Titles are used instead of reference-audio paths because several
            // voices may legitimately share the same reference file.
            const existingTitles = new Set<string>();
            const existing = await db.select(
                `SELECT title FROM data_storage WHERE biz = ?`,
                ["SoundVoice"],
            );
            for (const e of existing) {
                if (e.title) {
                    existingTitles.add(e.title);
                }
            }
            for (const r of records) {
                let content: any = {};
                try {
                    content = JSON.parse(r.content || "{}");
                } catch (e) {
                    content = {};
                }
                const url = (content && content.url) || "";
                const title = r.title || "";
                if (!url || existingTitles.has(title)) {
                    continue;
                }
                existingTitles.add(title);
                await db.insert(
                    `INSERT INTO data_storage (biz, title, sort, content)
                     VALUES (?, ?, ?, ?)`,
                    [
                        "SoundVoice",
                        r.title,
                        r.sort || 0,
                        JSON.stringify({
                            type: "clone",
                            serverKey: "",
                            serverName: "",
                            serverTitle: "",
                            serverVersion: "",
                            param: {},
                            promptUrl: url,
                            promptText: (content && content.promptText) || "",
                        }),
                    ],
                );
            }
        },
    },
];

export default {
    versions,
};
