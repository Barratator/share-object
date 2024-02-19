export const MessageTypes = {
    Register: "__shareobj_reg",
    Unregister: "__shareobj_unreg",
    Change: "__shareobj_chg"
}

export interface MessageRegister
{
    id: number;
    name: string;
    object: object;
}

export interface MessageUnregister
{
    id: number;
}

export interface MessageChange
{
    id: number;
    path: string[];
    value: any;
}