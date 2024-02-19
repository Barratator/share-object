import { makeProxy } from './makeproxy'

/*
const proxy = makeProxy({}, (prop, val) => {
	console.log("change", prop, val);
});

proxy.k1 = 2;
proxy.k1 = 3;
proxy.k2 = {};
proxy.k2.a = 5;
proxy.k2.a = 6;

*/

/*
import { Socket } from 'socket.io'
import SocketMock from 'socket.io-mock';

interface Obj2
{
	k: number;
}

interface MyInterface
{
	k1: number;
	k2: string;
	k3?: object;
}

const original: MyInterface = {
	k1: 5,
	k2: "bla",
	k3: undefined
};



let mockingSocket = new SocketMock();
const socket = mockingSocket.socketClient as unknown as Socket; // now you have type support on socket

const server = new GlobalServer(socket);
const object = server.makeGlobal<MyInterface>("foobar", original);

console.log(object.k1);
object.k1 = 49;
console.log(object.k1);*/