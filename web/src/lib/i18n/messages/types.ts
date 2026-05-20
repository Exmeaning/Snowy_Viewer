export type MessageNode = string | {
    readonly [key: string]: MessageNode;
};

export type MessageTree = {
    readonly [key: string]: MessageNode;
};
