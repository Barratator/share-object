export interface SocketLike
{
    on(event: string, fn: (message: any) => any);
    emit(event: string, payload: any);
    removeListener(event: string, fn: (message: any) => any);
}