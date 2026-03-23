// Type declarations for @langchain/langgraph (no official @types package available)
declare module "@langchain/langgraph" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const START: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const END: any;
   
   
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  export class StateGraph<T = any> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(config: { channels: Partial<Record<keyof T & string, any>> });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addNode(name: string, fn: any): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addEdge(from: any, to: any): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addConditionalEdges(from: string, condition: any, map?: any): this;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    compile(config?: any): any;
  }
   
  export class MemorySaver { constructor(); }
}

declare module "@langchain/langgraph/prebuilt" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export class ToolNode { constructor(tools: any[]); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function toolsCondition(state: any): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createReactAgent(config: any): any;
}
