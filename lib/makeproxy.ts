import { EventEmitter } from 'events'

const gloProxyCache = new WeakMap<object, typeof Proxy>(); // global!

export type AccessStack = string[];
export interface EventChange
{
    path: AccessStack;
	value: any;
}

export const ProxyObserver = Symbol("ProxyObserver");

export function makeProxy<T extends object>(object: T, path: AccessStack=[], onChange?: EventEmitter): T
{
	if(typeof object !== 'object') throw new Error("Invalid type");

	onChange ??= new EventEmitter();

	const newProxy = new Proxy(object, {
		get(target: any, prop: string | symbol, receiver: any) {
			if(typeof prop === 'symbol')
			{
				if(prop === ProxyObserver) return Reflect.get(target, prop);
				return false;
			}
			
			const item = target[prop];
			if(item && typeof item === 'object')
			{
				if(gloProxyCache.has(item)) return gloProxyCache.get(item);

				const newPath: AccessStack = [...path, prop];
				const newProxy = makeProxy(item, newPath, onChange);
				gloProxyCache.set(item, newProxy);
				return newProxy;
			}

			return Reflect.get(target, prop);
		},

		set(target: any, prop: string | symbol, value: any, receiver: any): boolean {
			if(typeof prop === 'symbol')
			{
				if(prop === ProxyObserver) return Reflect.set(target, prop, value);
				return false;
			}

			const newPath: AccessStack = [...path, prop];

			Reflect.set(target, prop, value);
			onChange?.emit("change", {
				path: newPath,
				value: value
			} as EventChange);
			return true;
		}
	});

	newProxy[ProxyObserver] = onChange;

	return newProxy;
}