const versions = [
    {
        version: 0,
        up: async (db: DB) => {
            // await db.execute(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)`);
            // console.log('db.insert', await db.insert(`INSERT INTO users (name, email) VALUES (?, ?)`,['Alice', 'alice@example.com']));
            // console.log('db.select', await db.select(`SELECT * FROM users`));
            // console.log('db.first', await db.first(`SELECT * FROM users`));
        }
    },
    {
        version:1,
        up: async (db: DB) => {
            await db.execute(`CREATE TABLE IF NOT EXISTS data_sound_tts (
                    id INTEGER PRIMARY KEY,

                    serverName TEXT,
                    serverTitle TEXT,
                    serverVersion TEXT,
                    speaker TEXT,
                    text TEXT,
                    speed TEXT,
                    seed TEXT,
                    param TEXT,

                    status TEXT,
                    statusMsg TEXT,
                    jobId TEXT,
                    jobResult TEXT,
                    startTime INTEGER,
                    endTime INTEGER,
                    resultWav TEXT
            )`);
            await db.execute(`CREATE TABLE IF NOT EXISTS data_sound_clone (
                    id INTEGER PRIMARY KEY,

                    serverName TEXT,
                    serverTitle TEXT,
                    serverVersion TEXT,
                    promptName TEXT,
                    promptWav TEXT,
                    promptText TEXT,
                    text TEXT,
                    speed TEXT,
                    seed TEXT,
                    param TEXT,

                    status TEXT,
                    statusMsg TEXT,
                    jobId TEXT,
                    jobResult TEXT,
                    startTime INTEGER,
                    endTime INTEGER,
                    resultWav TEXT
            )`);
        }
    }
]

export default {
    versions,
}


