import { vi, expect, test, beforeEach } from 'vitest'
import SocketMock from 'socket.io-mock';
import { SocketLike } from './types';
import { SharedObject, listenToSharedObject } from './client';
import { MessageChange, MessageRegister, MessageTypes, MessageUnregister } from './protocol';


interface ObjA
{
	k1: number;
	k2: string;
}

let socketServer: SocketLike
let socketClient: SocketLike;
beforeEach(async () => {
	let mock = new SocketMock();
	socketServer = mock as unknown as SocketLike;
	socketClient = mock.socketClient as unknown as SocketLike;
});


test('client calls on register with object', () => {
	const onRegister = vi.fn((sharedObject: SharedObject<ObjA>) => {
		const obj = sharedObject.getObject();
		expect(obj.k1).toBe(100);
		expect(obj.k2).toBe("foobar");
	});
	listenToSharedObject(socketClient, "test", onRegister);
	expect(onRegister).toBeCalledTimes(0);

	socketServer.emit(MessageTypes.Register, {
		id: 0,
		name: "test",
		object: {k1: 100, k2: "foobar"}
	} as MessageRegister);

	expect(onRegister).toBeCalledTimes(1);
})

test('client replicates changes', () => {
	let replicatedObject: ObjA;

	const onChange = vi.fn(() => {
		expect(replicatedObject.k1).toBe(101);
		expect(replicatedObject.k2).toBe("foobar");
	});

	const onRegister = vi.fn((sharedObject: SharedObject<ObjA>) => {
		replicatedObject = sharedObject.getObject();
		sharedObject.on('change', onChange);
	});
	listenToSharedObject(socketClient, "test", onRegister);
	expect(onRegister).toBeCalledTimes(0);

	socketServer.emit(MessageTypes.Register, {
		id: 0,
		name: "test",
		object: {k1: 100, k2: "foobar"}
	} as MessageRegister);

	socketServer.emit(MessageTypes.Change, {
		id: 0,
		path: ["k1"],
		value: 101
	} as MessageChange);

	expect(onRegister).toBeCalledTimes(1);
})

test('client emits unregister', () => {
	const onUnshare = vi.fn();
	const onRegister = vi.fn((sharedObject: SharedObject<ObjA>) => {
		sharedObject.on('unshare', onUnshare);
	});
	listenToSharedObject(socketClient, "test", onRegister);
	expect(onRegister).toBeCalledTimes(0);
	expect(onUnshare).toBeCalledTimes(0);

	socketServer.emit(MessageTypes.Register, {
		id: 0,
		name: "test",
		object: {k1: 100, k2: "foobar"}
	} as MessageRegister);

	socketServer.emit(MessageTypes.Unregister, {
		id: 0
	} as MessageUnregister);

	expect(onRegister).toBeCalledTimes(1);
	expect(onUnshare).toBeCalledTimes(1);
})


test('client can handle different named objects', () => {
	const onUnshare = vi.fn();
	const onShare = vi.fn((sharedObject: SharedObject<ObjA>) => {
		sharedObject.on('unshare', onUnshare);
	});
	listenToSharedObject(socketClient, "test1", onShare);
	listenToSharedObject(socketClient, "test2", onShare);
	expect(onShare).toBeCalledTimes(0);
	expect(onUnshare).toBeCalledTimes(0);

	socketServer.emit(MessageTypes.Register, {
		id: 0,
		name: "test1",
		object: {k1: 100, k2: "foobar"}
	} as MessageRegister);

	socketServer.emit(MessageTypes.Register, {
		id: 1,
		name: "test2",
		object: {k1: 100, k2: "foobar"}
	} as MessageRegister);

	socketServer.emit(MessageTypes.Register, {
		id: 2,
		name: "test3",
		object: {k1: 100, k2: "foobar"}
	} as MessageRegister);

	socketServer.emit(MessageTypes.Change, {
		id: 1,
		path: ['k1'],
		value: 101
	} as MessageChange);

	socketServer.emit(MessageTypes.Unregister, {
		id: 0
	} as MessageUnregister);

	expect(onShare).toBeCalledTimes(2);
	expect(onUnshare).toBeCalledTimes(1);
})

test('client can stop listening', () => {
	const onShare = vi.fn();
	const listener = listenToSharedObject(socketClient, "test1", onShare);

	expect(onShare).toBeCalledTimes(0);

	socketServer.emit(MessageTypes.Register, {
		id: 0,
		name: "test1",
		object: {k1: 100, k2: "foobar"}
	} as MessageRegister);

	expect(onShare).toBeCalledTimes(1);
	listener.stopListening();

	socketServer.emit(MessageTypes.Register, {
		id: 1,
		name: "test1",
		object: {k1: 100, k2: "foobar"}
	} as MessageRegister);

	expect(onShare).toBeCalledTimes(1);
})
