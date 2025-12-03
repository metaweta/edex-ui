// Renderer libraries bundle entry point
// This file bundles browser-compatible libraries for use in the renderer process
// After bundling, these will be available as window globals

// xterm and addons (browser-compatible)
import { Terminal } from 'xterm';
import { AttachAddon } from 'xterm-addon-attach';
import { FitAddon } from 'xterm-addon-fit';
import { WebglAddon } from 'xterm-addon-webgl';
// Note: xterm-addon-ligatures requires Node.js fs/path, loaded separately via require()

// Other browser-compatible libraries
import { Howl, Howler } from 'howler';
import { SmoothieChart, TimeSeries } from 'smoothie';
import Color from 'color';

// Expose to window for use by class files
window.XTerm = Terminal;
window.AttachAddon = AttachAddon;
window.FitAddon = FitAddon;
window.WebglAddon = WebglAddon;

window.Howl = Howl;
window.Howler = Howler;

window.SmoothieChart = SmoothieChart;
window.TimeSeries = TimeSeries;

window.colorLib = Color;

console.log('Renderer libraries loaded via bundle');
