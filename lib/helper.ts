export function assert(cond: any): asserts cond is true
{
    if(!cond) throw new Error("Assertion failed");
}