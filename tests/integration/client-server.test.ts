import { vi, expect, test, beforeEach } from 'vitest'
import SocketMock from 'socket.io-mock';
import { shareObject, unshareObject } from '../../lib/server'
import { SharedObject, listenToSharedObject } from '../../lib/client';
import { SocketLike } from '../../lib/types';


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

test('client received initial object', () => {
	const serverObj: ObjA = {
		k1: 42,
		k2: "foobar"
	};

	const onObject = vi.fn((sharedObj: SharedObject<ObjA>) => {
		expect(sharedObj.getObject()).toMatchObject(serverObj);
	});
	
	listenToSharedObject(socketClient, "test", onObject);

	const proxy = shareObject(socketServer, "test", serverObj);

	expect(onObject).toBeCalledTimes(1);
});

test('client received single change', async () => {
	const serverObj: ObjA = {
		k1: 42,
		k2: "foobar"
	};

	let sharedObjMeta;
	let sharedObj: ObjA|undefined;
	const onChange = vi.fn();
	const onObject = vi.fn((newSharedObj: SharedObject<ObjA>) => {
		sharedObjMeta = newSharedObj;
		sharedObj = sharedObjMeta.getObject();
		sharedObjMeta.on('change', onChange);
	});
	
	listenToSharedObject(socketClient, "test", onObject);

	const proxy = shareObject(socketServer, "test", serverObj);
	proxy.k1 = 100;
	
	await vi.waitFor(() => onChange.mock.calls.length > 0);
	expect(onChange).toBeCalledTimes(1);
	
	expect(sharedObj).toMatchObject({
		k1: 100,
		k2: "foobar"
	})
});