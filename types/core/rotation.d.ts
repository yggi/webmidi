/**
 * MPE-style channels for microtonal pieces: a note takes, from `channels`, one that nothing still sounds on (the one
 * free longest), so notes with different bends never share a channel; when all are busy, the one that frees first.
 */
export declare class Rotation {
    #private;
    readonly channels: readonly number[];
    constructor(channels: readonly number[]);
    take(end: number): number;
    forget(): void;
}
