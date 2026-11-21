export type GeneralModelParamType = {
    type: string;
    serverKey: string;
    serverName: string;
    serverTitle: string;
    serverVersion: string;
    funcName: string;
    param: any;
    // config.json general[].result 输出定义（用于结果展示）
    resultDef: any[];
};
