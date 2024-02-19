import { vi, expect, test, beforeEach } from 'vitest'
import SocketMock from 'socket.io-mock';
import { shareObject, unshareObject } from './server'
import { SocketLike } from './types';
import { MessageRegister, MessageTypes } from './protocol';

interface ObjA
{
	k1: number;
}

interface ObjB
{
	k1: string;
	k2: ObjA;
}

interface ObjC
{
	k1: string[]
}

let socketServer: SocketLike
let socketClient: SocketLike;
beforeEach(async () => {
	let mock = new SocketMock();
	socketServer = mock as unknown as SocketLike;
	socketClient = mock.socketClient as unknown as SocketLike;
});

test('server registers object', () => {
	const regCb = vi.fn();
	socketClient.on(MessageTypes.Register, regCb);

	const obj1: ObjA = { k1: 100 };
	const obj2: ObjA = { k1: 200 };
	const proxy1 = shareObject(socketServer, "test", obj1);
	expect(regCb).toBeCalledTimes(1);
	expect(regCb).toBeCalledWith({id: 0, name: "test", object: {k1: 100}});

	const proxy2 = shareObject(socketServer, "test", obj2);
	expect(regCb).toBeCalledTimes(2);
	expect(regCb).toBeCalledWith({id: 1, name: "test", object: {k1: 200}});
})

test('server sends primitve change', () => {
	const regCb = vi.fn();
	const chgCb = vi.fn();
	socketClient.on(MessageTypes.Register, regCb);
	socketClient.on(MessageTypes.Change, chgCb);

	const obj1: ObjA = { k1: 100 };
	const proxy1 = shareObject(socketServer, "test", obj1);
	expect(regCb).toBeCalledTimes(1);
	expect(chgCb).toBeCalledTimes(0);
	proxy1.k1 = 101;
	expect(chgCb).toBeCalledTimes(1);
	expect(chgCb).toBeCalledWith({id: 0, path: ["k1"], value: 101});
});

test('server sends nested change', () => {
	const chgCb = vi.fn();
	socketClient.on(MessageTypes.Change, chgCb);

	const obj1: ObjA = { k1: 100 };
	const obj3: ObjB = { k1: "foobar", k2: obj1};

	const proxy1 = shareObject(socketServer, "test", obj3);

	// changing values in nested type
	expect(chgCb).toBeCalledTimes(0);
	proxy1.k2.k1 = 101;
	expect(chgCb).toBeCalledTimes(1);
	expect(chgCb).toBeCalledWith({id: 0, path: ["k2", "k1"], value: 101});

	proxy1.k2.k1 = 102;
	expect(chgCb).toBeCalledTimes(2);
	expect(chgCb).toBeCalledWith({id: 0, path: ["k2", "k1"], value: 102});

	proxy1.k1 = "blubb";
	expect(chgCb).toBeCalledTimes(3);
	expect(chgCb).toBeCalledWith({id: 0, path: ["k1"], value: "blubb"});
});

test('server sends nested changes on swapping object', () => {
	const chgCb = vi.fn();
	socketClient.on(MessageTypes.Change, chgCb);

	const obj1: ObjA = { k1: 100 };
	const obj2: ObjA = { k1: 200 };
	const obj3: ObjB = { k1: "foobar", k2: obj1};

	const proxy1 = shareObject(socketServer, "test", obj3);
	proxy1.k2 = obj2;

	expect(chgCb).toBeCalledTimes(1);
	expect(chgCb).toBeCalledWith({id: 0, path: ["k2"], value: {k1 : 200}});
});

test('server sends unshare event', () => {
	const regCb = vi.fn();
	const unregCb = vi.fn();
	const chgCb = vi.fn();
	socketClient.on(MessageTypes.Change, chgCb);
	socketClient.on(MessageTypes.Register, regCb);
	socketClient.on(MessageTypes.Unregister, unregCb);

	const obj1: ObjA = { k1: 100 };

	const proxy1 = shareObject(socketServer, "test", obj1);
	expect(regCb).toBeCalledTimes(1);
	expect(unregCb).toBeCalledTimes(0);
	expect(chgCb).toBeCalledTimes(0);
	unshareObject(socketServer, proxy1);
	expect(unregCb).toBeCalledTimes(1);
	expect(() => unshareObject(socketServer, proxy1)).toThrow(); // double unshare
});

test('server sends share after unsharing', () => {
	const regCb = vi.fn();
	const unregCb = vi.fn();
	const chgCb = vi.fn();
	socketClient.on(MessageTypes.Change, chgCb);
	socketClient.on(MessageTypes.Register, regCb);
	socketClient.on(MessageTypes.Unregister, unregCb);

	const obj1: ObjA = { k1: 100 };

	const proxy1 = shareObject(socketServer, "test", obj1);
	expect(regCb).toBeCalledTimes(1);
	expect(unregCb).toBeCalledTimes(0);
	expect(chgCb).toBeCalledTimes(0);
	unshareObject(socketServer, proxy1);
	expect(unregCb).toBeCalledTimes(1);
	const proxy2 = shareObject(socketServer, "test", obj1);
	expect(regCb).toBeCalledTimes(2);
	expect(unregCb).toBeCalledTimes(1);
	expect(chgCb).toBeCalledTimes(0);
	proxy2.k1 = 101;
	expect(chgCb).toBeCalledTimes(1);
	unshareObject(socketServer, proxy2);
	expect(unregCb).toBeCalledTimes(2);
});

test('unshare needs to happen on proxy', () => {
	const obj1: ObjA = { k1: 100 };

	const proxy1 = shareObject(socketServer, "test", obj1);
	expect(() => unshareObject(socketServer, obj1)).toThrow();
});

test('share an array', () => {
	const obj1: ObjC = {k1: ["a", "b"]};

	const regCb = vi.fn();
	const chgCb = vi.fn();
	socketClient.on(MessageTypes.Change, chgCb);
	socketClient.on(MessageTypes.Register, regCb);

	const proxy1 = shareObject(socketServer, "test", obj1);

	expect(regCb).toBeCalledWith({
		id: 0,
		name: "test",
		object: {k1: ["a", "b"]}
	} as MessageRegister);

	proxy1.k1.push("c");

	expect(chgCb).toBeCalledWith({id: 0, path: ["k1", 2], value: "c"});
	expect(chgCb).toBeCalledWith({id: 0, path: ["k1", "length"], value: 3});
});