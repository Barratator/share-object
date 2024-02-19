import { EventChange, ProxyObserver, makeProxy } from "./makeproxy";
import { SocketLike } from "./types";
import { EventEmitter } from 'events'
import { MessageChange, MessageRegister, MessageTypes } from "./protocol";

const SymbolSharedObjectsOnSocket = Symbol("SharedObjectsOnSocket");
const SymbolNextIdOnSocket = Symbol("NextIdOnSocket");
type ChangeCb = (change: EventChange) => void;

interface SharedObject
{
	id: number;
	changeCb: ChangeCb;
}

export function shareObject<T extends object>(socket: SocketLike, name: string, object: T): T
{
	if(typeof name !== 'string') throw new Error("Invalid name");

	socket[SymbolNextIdOnSocket] ??= 0;
	const id = socket[SymbolNextIdOnSocket]++;

	// make proxy and hook into it
	const onChange = (change: EventChange) => {
		const value = typeof change.value === 'object' ? makeCleanObject(change.value) : change.value;

		socket.emit(MessageTypes.Change, {
			id,
			path: makeCleanPath(change.path, object),
			value
		} as MessageChange);
	};

	const proxy = makeProxy(object);
	proxy[ProxyObserver].on('change', onChange);
	socket[SymbolSharedObjectsOnSocket] ??= new WeakMap<object, SharedObject>();
	socket[SymbolSharedObjectsOnSocket].set(proxy, {
		id,
		name,
		changeCb: onChange
	} as SharedObject);

	// share initial
	socket.emit(MessageTypes.Register, {
		id,
		name,
		object: makeCleanObject(object)
	} as MessageRegister);

	return proxy;
}

export function unshareObject<T extends object>(socket: SocketLike, object: T): void
{
	if(!object[ProxyObserver]) throw new Error("Object is not shared");
	if(!socket[SymbolSharedObjectsOnSocket] || !socket[SymbolSharedObjectsOnSocket].has(object))
		throw new Error("Object is not shared on this socket");

	const map: WeakMap<object, SharedObject> = socket[SymbolSharedObjectsOnSocket];
	const emitter: EventEmitter = object[ProxyObserver];
	const sharedObject = map.get(object) as SharedObject;
	map.delete(object);
	emitter.removeListener('change', sharedObject.changeCb);

	socket.emit(MessageTypes.Unregister, {
		id: sharedObject.id
	});
}

function makeCleanObject<T extends object>(object: T): T
{
	if(typeof object !== 'object') throw new Error("Invalid object")
	const isArray = Array.isArray(object);
	const out = isArray ? [] : {};

	Object.keys(object).forEach((keyStr: string) => {
		const key = isArray ? parseInt(keyStr) : keyStr;
		const val = object[key];
		const type = typeof val;

		switch(type)
		{
			case 'object': out[key] = makeCleanObject(val); break;
			case 'string':
			case 'number':
			case 'bigint':
			case 'boolean':
				out[key] = val;
				break;
		}
	});

	return out as T;
}

function makeCleanPath<T>(path: string[], value: T): (string|number)[]
{
	if(path.length === 0) return [];
	let key: string|number = path[0];

	if(Array.isArray(value) && key !== 'length')
	{
		key = parseInt(key);
	}
	
	return [key, ...makeCleanPath(path.slice(1), value[key])];
}