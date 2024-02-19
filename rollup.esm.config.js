import typescript from '@rollup/plugin-typescript';

export default {
	input: './lib/main.ts',
	output: {
		file: './dist/bundle.esm.js',
		format: 'esm',
		name: 'bundle'
	},
	plugins: [typescript()]
}