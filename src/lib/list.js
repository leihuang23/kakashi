/**
 * List data structure with O(1) prepend and O(1) random access
 * Implemented as a circular buffer with automatic resize
 */
class _List {
    static create(initialCapacity = 16) {
      const list = new _List(initialCapacity);
      return new Proxy(list, {
        get(target, prop) {
          if (typeof prop === "string" && /^\d+$/.test(prop)) {
            return target.get(parseInt(prop));
          }
          return target[prop];
        },
      });
    }
  
    constructor(initialCapacity = 16) {
      this.initialCapacity = initialCapacity;
      this._capacity = initialCapacity;
      this._buffer = new Array(initialCapacity).fill(null);
      this._head = Math.floor(initialCapacity / 2);
      this._tail = this._head - 1;
      this.length = 0;
    }
  
    prepend(item) {
      if (this._head === 0) this._resize();
      this._buffer[--this._head] = item;
      return ++this.length;
    }
  
    append(item) {
      if (this._tail === this._capacity - 1) this._resize();
      this._buffer[++this._tail] = item;
      return ++this.length;
    }
  
    pop() {
      if (this.length === 0) return undefined;
      const item = this._buffer[this._tail];
      this._buffer[this._tail] = null;
      this._tail--;
      this.length--;
      return item;
    }
  
    get(index) {
      if (index < 0 || index >= this.length) return undefined;
      return this._buffer[this._head + index];
    }
  
    set(index, value) {
      if (index < 0 || index >= this.length) return false;
      this._buffer[this._head + index] = value;
      return true;
    }
  
    clear() {
      const initialCapacity = this.initialCapacity;
      this._capacity = initialCapacity;
      this._buffer = new Array(initialCapacity).fill(null);
      this._head = Math.floor(initialCapacity / 2);
      this._tail = this._head - 1;
      this.length = 0;
    }
  
    _resize() {
      const newCapacity = this._capacity * 2;
      const newBuffer = new Array(newCapacity).fill(null);
      const newHead = Math.floor((newCapacity - this.length) / 2);
  
      for (let i = 0; i < this.length; i++) {
        newBuffer[newHead + i] = this._buffer[this._head + i];
      }
  
      this._buffer = newBuffer;
      this._head = newHead;
      this._tail = this._head + this.length - 1;
      this._capacity = newCapacity;
    }
  
    [Symbol.iterator]() {
      let index = 0;
      const list = this;
  
      return {
        next() {
          if (index < list.length) {
            return { value: list.get(index++), done: false };
          } else {
            return { done: true };
          }
        },
      };
    }
  
    forEach(callback) {
      for (let i = 0; i < this.length; i++) {
        callback(this.get(i), i);
      }
    }
  
    map(callback) {
      const result = _List.create(this.length);
      for (let i = 0; i < this.length; i++) {
        result.append(callback(this.get(i), i));
      }
      return result;
    }
  
    filter(callback) {
      const result = _List.create(this.length);
      for (let i = 0; i < this.length; i++) {
        const item = this.get(i);
        if (callback(item, i)) {
          result.append(item);
        }
      }
      return result;
    }
  }
  
  export const List = _List.create;
  