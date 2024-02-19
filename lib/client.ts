import { SocketLike } from "./types";
import { EventEmitter } from 'events'
import { assert } from './helper'
import { MessageChange, MessageRegister, MessageTypes, MessageUnregister } from "./protocol";


type OnRegister = (message: any) => void;
type OnUnregister = (message: any) => void;
type OnChange = (message: any) => void;

export class SharedObjectListener
{
	constructor(private socket: SocketLike,
		private onRegister: OnRegister,
		private onUnregister: OnUnregister,
		private onChange: OnChange)
	{
		socket.on(MessageTypes.Change, onChange);
		socket.on(MessageTypes.Register, onRegister);
		socket.on(MessageTypes.Unregister, onUnregister);
	}

	stopListening()
	{
		this.socket.removeListener(MessageTypes.Change, this.onChange);
		this.socket.removeListener(MessageTypes.Register, this.onRegister);
		this.socket.removeListener(MessageTypes.Unregister, this.onUnregister);
	}
}

export class SharedObject<T> extends EventEmitter
{
	constructor(private object: T, private name: string)
	{
		super();
	}

	getObject(): T
	{
		return this.object;
	}

	getName(): string
	{
		return this.name;
	}
}

export function listenToSharedObject<T extends object>(
	socket: SocketLike,
	name: string,
	onObject: (object: SharedObject<T>) => void): SharedObjectListener
{
	const objects = new Map<number, SharedObject<T>>();

	const onRegister = (message: MessageRegister) => {
		if(objects.has(message.id)) throw new Error("Duplicate shared object");
		if(message.name !== name) return; // ignore for this listener

		const object = message.object;
		const shared = new SharedObject(object as T, message.name);
		objects.set(message.id, shared);
		onObject(shared);
	}

	const onUnregister = (message: MessageUnregister) => {
		const shared = objects.get(message.id);
		if(!shared) return; // legal, as it might be for a different name

		objects.delete(message.id);
		shared.emit("unshare");
	}

	const onChange = (message: MessageChange) => {
		const shared = objects.get(message.id);
		if(!shared) return; // legal, as it might be for a different name

		applyValueUsingPath(shared.getObject(), message.path, message.value);
		shared.emit("change", {
			path: message.path,
			value: message.value
		});
	}

	return new SharedObjectListener(socket, onRegister, onUnregister, onChange);
}

function applyValueUsingPath(object: object, path: string[], value: any)
{
	const key = path[0];
	if(path.length > 1)
	{
		applyValueUsingPath(object[key], path.slice(1), value);
		return;
	}
	else if(path.length === 1)
	{
		object[key] = value;
	}
	else
	{
		throw new Error("Invalid path");
	}
}