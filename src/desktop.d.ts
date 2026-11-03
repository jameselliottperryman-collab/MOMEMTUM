export {};
declare global {
  interface Window {
    relayworkDesktop?: {
      platform: string;
      onBeforeQuit: (callback: () => Promise<boolean>) => () => void;
      onAction: (
        callback: (
          action:
            | "new-task"
            | "search"
            | "my-work"
            | "inbox"
            | "board"
            | "list"
            | "help",
        ) => void,
      ) => () => void;
    };
  }
}
