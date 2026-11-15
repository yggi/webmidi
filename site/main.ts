// The standalone patchbay page (docs/proposals/patchbay.md, section 4): webmidi's components on a page of their own.
import { mount } from 'svelte';
import { localBookStore, localPanelStore } from '../src/web/index';
import App from './App.svelte';
import { Bay } from './bay.svelte';
import { Synth } from './synth';

mount(App, { target: document.getElementById('app')!, props: { bay: new Bay(localBookStore('webmidi-bay:book'), localPanelStore('webmidi-bay:panels'), new Synth()) } });
