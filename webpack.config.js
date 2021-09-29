/**
 * Copyright (c) 2017, Neap Pty Ltd.
 * All rights reserved.
 * 
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
*/
const path = require('path')
const TerserPlugin = require("terser-webpack-plugin")

const env = process.env.WEBPACK_ENV
const outputfilename = "graphqls2s"
const prod = env == "build"

const { plugins, outputfile } = prod
	? { plugins: [], outputfile: `${outputfilename}.min.js` } 
	: { plugins: [], outputfile: `${outputfilename}.js` } 

module.exports = {
	entry: [
		'babel-polyfill',
		'./src/graphqls2s.js'
	],
	output: {
		path: __dirname + '/lib',
		filename: outputfile,
		libraryTarget: 'umd',
		umdNamedDefine: true,
		globalObject: 'this'
	},
	module: {
		rules: [{
			loader: "babel-loader",
			exclude: [
				path.resolve(__dirname, "node_modules")
			],
			// Only run `.js` and `.jsx` files through Babel
			test: /\.jsx?$/,
			// Options to configure babel with
			options: {
				plugins: ['transform-runtime'],
				presets: ['es2015'],
			}
		}, ]
	},
	devtool: 'source-map',
	plugins: plugins,
	optimization: {
		minimize: prod,
		minimizer: [new TerserPlugin()]
	}
}