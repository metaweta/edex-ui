// esbuild configuration for bundling renderer libraries
import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bundle renderer libraries for browser use
await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/renderer-libs.js')],
    bundle: true,
    outfile: path.join(__dirname, 'src/dist/renderer-libs.bundle.js'),
    format: 'iife',  // Immediately invoked function expression for browser
    platform: 'browser',
    target: ['chrome120'],  // Electron 28 uses Chrome 120
    minify: false,  // Keep readable for debugging
    sourcemap: true,
    loader: {
        '.js': 'jsx',  // Handle JSX if any
    },
    // External packages that shouldn't be bundled (handled elsewhere)
    external: [],
    // Define globals
    define: {
        'process.env.NODE_ENV': '"production"',
    },
    // Copy CSS files needed by xterm
    logLevel: 'info',
});

console.log('Bundle built successfully!');
