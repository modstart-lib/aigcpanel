export type StorageBiz =
    | "SoundPrompt"
    | "LiveAvatar"
    | "LiveKnowledge"
    | "LiveEvent"
    | "LiveTalk"
    | "LiveVoice"
    | "SoundVoice";

export type StorageRecord = {
    id?: number;

    biz: StorageBiz;

    sort?: number;
    title?: string;
    content?: any;

    runtime?: StorageRuntime;
};

export type StorageRuntime = {};

export const StorageService = {
    tableName() {
        return "data_storage";
    },
    decodeRecord(record: StorageRecord): StorageRecord | null {
        if (!record) {
            return null;
        }
        return {
            ...record,
            content: JSON.parse(record.content ? record.content : "{}"),
        } as StorageRecord;
    },
    encodeRecord(record: StorageRecord): StorageRecord {
        if ("content" in record) {
            record.content = JSON.stringify(record.content || {});
        }
        return record;
    },
    async getByTitle(
        biz: StorageBiz,
        title: string,
    ): Promise<StorageRecord | null> {
        const record: any = await window.$mapi.db.first(
            `SELECT *
             FROM ${this.tableName()}
             WHERE biz = ?
               AND title = ?`,
            [biz, title],
        );
        return this.decodeRecord(record);
    },
    async get(id: number): Promise<StorageRecord | null> {
        const record: any = await window.$mapi.db.first(
            `SELECT *
             FROM ${this.tableName()}
             WHERE id = ?`,
            [id],
        );
        return this.decodeRecord(record);
    },
    async listByIds(ids: number[]): Promise<StorageRecord[]> {
        if (!ids || ids.length === 0) {
            return [];
        }
        const records: StorageRecord[] = await window.$mapi.db.select(
            `SELECT *
             FROM ${this.tableName()}
             WHERE id IN (${ids.join(",")})`,
            [],
        );
        return records.map(this.decodeRecord) as StorageRecord[];
    },
    async list(biz: StorageBiz): Promise<StorageRecord[]> {
        const records: StorageRecord[] = await window.$mapi.db.select(
            `SELECT *
             FROM ${this.tableName()}
             WHERE biz = ?
             ORDER BY id DESC`,
            [biz],
        );
        return records.map(this.decodeRecord) as StorageRecord[];
    },
    async add(biz: StorageBiz, record: Partial<StorageRecord>) {
        const fields = ["biz", "title", "sort", "content"];
        record["biz"] = biz;
        record = this.encodeRecord(record as StorageRecord);
        const values = fields.map((f) => record[f]);
        const valuesPlaceholder = fields.map((f) => "?");
        const id = await window.$mapi.db.insert(
            `INSERT INTO ${this.tableName()} (${fields.join(",")})
             VALUES (${valuesPlaceholder.join(",")})`,
            values,
        );
    },
    async update(id: number, record: Partial<StorageRecord>) {
        record = this.encodeRecord(record as StorageRecord);
        const fields = Object.keys(record);
        const values = fields.map((f) => record[f]);
        const set = fields.map((f) => `${f} = ?`).join(",");
        return await window.$mapi.db.execute(
            `UPDATE ${this.tableName()}
             SET ${set}
             WHERE id = ?`,
            [...values, id],
        );
    },
    async addOrUpdate(
        biz: StorageBiz,
        id: number,
        record: Partial<StorageRecord>,
    ) {
        if (!id) {
            await this.add(biz, record);
        } else {
            await this.update(id, record);
        }
    },
    async delete(record: StorageRecord) {
        const filesForClean: string[] = [];
        if (record.content) {
            if (record.content.url) {
                filesForClean.push(record.content.url);
            }
        }
        for (const file of filesForClean) {
            await window.$mapi.file.deletes(file);
        }
        await window.$mapi.db.delete(
            `DELETE
             FROM ${this.tableName()}
             WHERE id = ?`,
            [record.id],
        );
    },
    async clear(biz: StorageBiz) {
        await window.$mapi.db.delete(
            `DELETE
             FROM ${this.tableName()}
             WHERE biz = ?`,
            [biz],
        );
    },
    async count(biz: StorageBiz, startTime: number = 0, endTime: number = 0) {
        let sql = `SELECT COUNT(*) as cnt
                   FROM ${this.tableName()}
                   WHERE biz = ?`;
        let params: any[] = [biz];
        if (startTime > 0) {
            sql += ` AND createdAt >= ?`;
            params.push(startTime);
        }
        if (endTime > 0) {
            sql += ` AND createdAt <= ?`;
            params.push(endTime);
        }
        const result = await window.$mapi.db.first(sql, params);
        return result.cnt;
    },
};
