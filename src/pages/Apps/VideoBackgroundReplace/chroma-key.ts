export type ChromaKeyOption = {
    /** 被抠除的颜色（十六进制） */
    keyColor: string;
    /** 颜色相似度阈值 0 ~ 1 */
    similarity: number;
    /** 边缘融合过渡 0 ~ 1 */
    blend: number;
};

/** sqrt(3) * 255，RGB 空间最大距离，用于把距离归一化到 0~1 */
const MAX_DIST = 441.6729559300637;
const MAX_DIST_SQ = 3 * 255 * 255;

export const hexToRgb = (hex: string) => {
    let h = (hex || "").replace("#", "").trim();
    if (h.length === 3) {
        h = `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
    }
    if (!/^[0-9a-fA-F]{6}$/.test(h)) {
        h = "00FF00";
    }
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
};

/**
 * 色键抠像：把与 keyColor 接近的像素置为透明，边缘按 blend 做线性过渡。
 * 就地在 `ImageData.data` 上修改。
 *
 * ⚠️ 预览（VideoBackgroundReplaceParamForm）与实际渲染（util.ts）共用本函数，
 * 保证参数行为完全一致、所见即所得。
 */
export const applyChromaKey = (
    data: Uint8ClampedArray,
    option: ChromaKeyOption,
) => {
    const { r: kr, g: kg, b: kb } = hexToRgb(option.keyColor);
    const similarity = Math.max(option.similarity, 0);
    const blend = Math.max(option.blend, 0);
    // 用平方距离比较，避免逐像素开方（边缘像素才需要开方）
    const simThreshold = similarity * similarity * MAX_DIST_SQ;
    const blendThreshold =
        (similarity + blend) * (similarity + blend) * MAX_DIST_SQ;
    for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - kr;
        const dg = data[i + 1] - kg;
        const db = data[i + 2] - kb;
        const distSq = dr * dr + dg * dg + db * db;
        if (distSq <= simThreshold) {
            data[i + 3] = 0;
        } else if (blend > 0 && distSq <= blendThreshold) {
            const dist = Math.sqrt(distSq) / MAX_DIST;
            data[i + 3] = Math.round(((dist - similarity) / blend) * 255);
        }
    }
};
