declare module 'find-free-port' {
  function findFreePort(startPort: number, endPort?: number, host?: string): Promise<[number]>;
  export = findFreePort;
}
