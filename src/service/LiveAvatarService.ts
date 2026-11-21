export type LiveAvatarRecord = {
    id?: number;
    name: string;
    video: string;
    info: any;
};

export const LiveAvatarService = {
    tableName() {
        return "live_avatar";
    },
    decodeRecord(record: LiveAvatarRecord): LiveAvatarRecord | null {
        if (!record) {
            return null;
        }
        return {
            ...record,
            info: record.info ? JSON.parse(record.info) : {},
        } as LiveAvatarRecord;
    },
    encodeRecord(record: LiveAvatarRecord): LiveAvatarRecord {
        if ("info" in record) {
            record.info = JSON.stringify(record.info || {});
        }
        return record;
    },
    async get(id: number): Promise<LiveAvatarRecord | null> {
        const record: any = await window.$mapi.db.first(
            `SELECT * FROM ${this.tableName()} WHERE id = ?`,
            [id],
        );
        return this.decodeRecord(record);
    },
    async getByName(name: string): Promise<LiveAvatarRecord | null> {
        const record: any = await window.$mapi.db.first(
            `SELECT * FROM ${this.tableName()} WHERE name = ?`,
            [name],
        );
        return this.decodeRecord(record);
    },
    async list(): Promise<LiveAvatarRecord[]> {
        const records: LiveAvatarRecord[] = await window.$mapi.db.select(
            `SELECT * FROM ${this.tableName()} ORDER BY id DESC`,
        );
        return records.map(this.decodeRecord) as LiveAvatarRecord[];
    },
    async insert(record: LiveAvatarRecord) {
        record = this.encodeRecord(record);
        const fields = Object.keys(record).join(", ");
        const values = Object.values(record);
        const valuePlaceholders = values.map(() => "?").join(", ");
        return await window.$mapi.db.insert(
            `INSERT INTO ${this.tableName()} (${fields}) VALUES (${valuePlaceholders})`,
            values,
        );
    },
    async delete(record: LiveAvatarRecord) {
        if (record.video) {
            await window.$mapi.file.hubDelete(record.video);
        }
        await window.$mapi.db.delete(
            `DELETE FROM ${this.tableName()} WHERE id = ?`,
            [record.id],
        );
    },
    async update(id: number, record: Partial<LiveAvatarRecord>) {
        record = this.encodeRecord(record as LiveAvatarRecord);
        const fields = Object.keys(record)
            .map((key) => `${key} = ?`)
            .join(", ");
        const values = Object.values(record);
        values.push(id);
        await window.$mapi.db.execute(
            `UPDATE ${this.tableName()} SET ${fields}, updatedAt = strftime('%s','now') WHERE id = ?`,
            values,
        );
    },
};
