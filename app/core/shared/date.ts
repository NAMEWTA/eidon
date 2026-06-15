export const toUnixSeconds = (date: Date): number =>
  Math.floor(date.getTime() / 1000);

export const toUnixMilliseconds = (date: Date): number => date.getTime();
