export const mapError = (e) => {
    let msg = e;
    if (e instanceof Error) {
        msg = [e.message, e.stack].join("\n");
    } else if (typeof e !== "string") {
        msg = e === null || e === undefined ? "UnknownError" : e.toString();
    }
    const map = {
        // 'fetch error': '网络错误',
    };
    for (let key in map) {
        if (msg.includes(key)) {
            let error = map[key];
            // regex PluginReleaseDocFormatError:-11
            const regex = new RegExp(`${key}:(-?\\d+)`);
            const match = msg.match(regex);
            if (match) {
                error += `(${match[1]})`;
            }
            return error;
        }
    }
    return msg;
};
