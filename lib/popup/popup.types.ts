export interface PopupLaunchOptions {
  url: string;
  target?: string;
  width?: number;
  height?: number;
  features?: string;
  focus?: boolean;
}

export interface PopupLaunchResult {
  popup: Window | null;
  blocked: boolean;
}
