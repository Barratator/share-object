import { vi, expect, test, assert } from 'vitest'
import { ProxyObserver, makeProxy } from './makeproxy';

interface TestA
{
}

interface TestB
{
	k1: number;
	k2: string;
	k3: number[];
}

interface TestC
{
	k1: number;
	k2: TestB;
}

interface TestD
{
	k1: number;
	k2?: TestD;
}

test('fails without object', () => {
	expect(() => makeProxy(undefined as unknown as object)).toThrow();
});

test('no action on empty object', () => {
	const obj: TestA = {};
	const changeFn = vi.fn();
	const tracker = makeProxy(obj);
	tracker[ProxyObserver].on("change", changeFn);

	expect(changeFn).toBeCalledTimes(0);
});

test('trigger once on primitive change', () => {
	const obj: TestB = {
		k1: 1,
		k2: "foobar",
		k3: []
	};
	const changeFn = vi.fn();
	const proxy = makeProxy(obj);
	proxy[ProxyObserver].on("change", changeFn);

	expect(changeFn).toBeCalledTimes(0);
	proxy.k1 = 2;
	expect(changeFn).toBeCalledTimes(1);
	proxy.k1 = 3;
	expect(changeFn).toBeCalledTimes(2);
});

test('trigger once on object in tree change', () => {
	const objB: TestB = {
		k1: 1,
		k2: "foobar",
		k3: []
	};
	const objC: TestC = {
		k1: 2,
		k2: objB
	};

	const changeFn = vi.fn();
	const proxy = makeProxy(objC);
	proxy[ProxyObserver].on("change", changeFn);

	proxy.k2.k1 = 2;
	expect(changeFn).toBeCalledTimes(1);
});

test('make sure proxies are reused', () => {
	const objB: TestB = {
		k1: 1,
		k2: "foobar",
		k3: []
	};
	const objC: TestC = {
		k1: 2,
		k2: objB
	};

	const changeFn = vi.fn();
	const proxy = makeProxy(objC);
	proxy[ProxyObserver].on("change", changeFn);

	const p1 = proxy.k2;
	p1.k1 = 2;

	const p2 = proxy.k2;
	p2.k1 = 3;

	expect(p1).toBe(p2);
	expect(changeFn).toBeCalledTimes(2);
});

test('proxies are serializable', () => {
	const objB: TestB = {
		k1: 1,
		k2: "foobar",
		k3: []
	};
	const objC: TestC = {
		k1: 2,
		k2: objB
	};

	const changeFn = vi.fn();
	const proxy = makeProxy(objC);
	proxy[ProxyObserver].on("change", changeFn);

	proxy.k2.k1 = 2;

	const str = JSON.stringify(objC);
	expect(str).toContain("foobar");
});

test('circular behavior', () => {
	const obj: TestD = {
		k1: 1,
		k2: undefined
	};
	obj.k2 = obj;

	const changeFn = vi.fn();
	const proxy = makeProxy(obj);
	proxy[ProxyObserver].on("change", changeFn);
	
	expect(changeFn).toBeCalledTimes(0);
	proxy.k1 = 2;
	expect(changeFn).toBeCalledTimes(1);
	assert(proxy.k2);
	proxy.k2.k1 = 3;
	expect(changeFn).toBeCalledTimes(2);
	proxy.k2 = undefined;
	expect(changeFn).toBeCalledTimes(3);
});

test.skip('change on removed member', () => {
	const obj1: TestD = {
		k1: 1,
		k2: undefined
	};
	const obj2: TestD = {
		k1: 1,
		k2: undefined
	};

	const changeFn = vi.fn();
	const proxy = makeProxy(obj1);
	proxy[ProxyObserver].on("change", changeFn);

	expect(changeFn).toBeCalledTimes(0);
	proxy.k1 = 2;
	expect(changeFn).toBeCalledTimes(1);
	proxy.k2 = obj2;
	expect(changeFn).toBeCalledTimes(2);
	proxy.k2.k1 = 3;
	expect(changeFn).toBeCalledTimes(3);
	const proxy2 = proxy.k2;
	
	// this should unsubscribe the changes from the sub object
	proxy.k2 = undefined;
	expect(changeFn).toBeCalledTimes(4);
	proxy2.k1 = 4;
	expect(changeFn).toBeCalledTimes(4);
});

test('correct path', () => {
	const objB: TestB = {
		k1: 1,
		k2: "foobar",
		k3: []
	};
	const objC: TestC = {
		k1: 2,
		k2: objB
	};

	const changeFn = vi.fn();
	const proxy = makeProxy(objC);
	proxy[ProxyObserver].on("change", changeFn);

	proxy.k1 = 2;

	expect(changeFn).toBeCalledWith({path: ["k1"], value: 2});

	proxy.k2.k1 = 42;

	expect(changeFn).toBeCalledWith({path: ["k2", "k1"], value: 42});

});

test('array member', () => {
	const objB: TestB = {
		k1: 1,
		k2: "foobar",
		k3: []
	};

	const changeFn = vi.fn();
	const proxy = makeProxy(objB);
	proxy[ProxyObserver].on("change", changeFn);

	expect(changeFn).toBeCalledTimes(0);
	proxy.k3.push(100);
	expect(changeFn).toBeCalledTimes(2); // item itself and .length
	proxy.k3.pop();
	expect(changeFn).toBeCalledTimes(3); // only .length updates
	proxy.k3.push(200);
	expect(changeFn).toBeCalledTimes(5); // item itself and .length
	proxy.k3.unshift(199);
	expect(changeFn).toBeCalledTimes(8); // item itself, reset item 0 to 1 and .length
});

test('correct path with array', () => {
	const objB: TestB = {
		k1: 1,
		k2: "foobar",
		k3: []
	};

	const changeFn = vi.fn();
	const proxy = makeProxy(objB);
	proxy[ProxyObserver].on("change", changeFn);
	
	proxy.k3.push(100);
	expect(changeFn).toBeCalledWith({path: ["k3", "0"], value: 100});
	expect(changeFn).toBeCalledWith({path: ["k3", "length"], value: 1});
	changeFn.mockClear();

	proxy.k3.push(101);
	expect(changeFn).toBeCalledWith({path: ["k3", "1"], value: 101});
	expect(changeFn).toBeCalledWith({path: ["k3", "length"], value: 2});
	changeFn.mockClear();

	proxy.k3.unshift(99);
	expect(changeFn).toBeCalledWith({path: ["k3", "0"], value: 99});
	expect(changeFn).toBeCalledWith({path: ["k3", "1"], value: 100});
	expect(changeFn).toBeCalledWith({path: ["k3", "2"], value: 101});
	expect(changeFn).toBeCalledWith({path: ["k3", "length"], value: 3});
	changeFn.mockClear();
});