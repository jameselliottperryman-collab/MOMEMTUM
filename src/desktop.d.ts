export {};
declare global {
  interface Window {
    relayworkDesktop?: {
      platform: string;
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
