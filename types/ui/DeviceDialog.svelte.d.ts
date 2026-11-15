/**
   * An output's details as a dialog over the page: the `DeviceInspector`, opened from the output's head in the matrix
   * (`PatchMatrix` opens it itself), so the matrix holds the patch and nothing of a device's settings. Escape, the ×
   * or a press outside closes it; the focus goes into it and stays there while it is open, and returns to where it
   * was. On a narrow screen it is a sheet from the bottom. It takes what the inspector takes, and `onclose`.
   */
import type { ComponentProps } from 'svelte';
import DeviceInspector from './DeviceInspector.svelte';
type Props = ComponentProps<typeof DeviceInspector> & {
    onclose: () => void;
};
declare const DeviceDialog: import("svelte").Component<Props, {}, "">;
type DeviceDialog = ReturnType<typeof DeviceDialog>;
export default DeviceDialog;
