// Ambient type declarations for bun:test so the Expo tsconfig doesn't error
// when it encounters test files. These mirror the bun test runner API.
declare module "bun:test" {
  type Done = (err?: unknown) => void;
  type TestFn = () => void | Promise<void>;
  type EachFn<T> = (value: T) => void | Promise<void>;

  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: TestFn): void;
  export function test(name: string, fn: TestFn): void;
  export function beforeAll(fn: TestFn): void;
  export function afterAll(fn: TestFn): void;
  export function beforeEach(fn: TestFn): void;
  export function afterEach(fn: TestFn): void;

  interface Matchers<R> {
    toBe(expected: unknown): R;
    toEqual(expected: unknown): R;
    toStrictEqual(expected: unknown): R;
    toBeTruthy(): R;
    toBeFalsy(): R;
    toBeNull(): R;
    toBeUndefined(): R;
    toBeDefined(): R;
    toContain(item: unknown): R;
    toHaveLength(length: number): R;
    toBeGreaterThan(n: number): R;
    toBeGreaterThanOrEqual(n: number): R;
    toBeLessThan(n: number): R;
    toBeLessThanOrEqual(n: number): R;
    toThrow(error?: unknown): R;
    not: Matchers<R>;
  }

  export function expect(value: unknown): Matchers<void>;
}
